#!/usr/bin/env python3
"""
Beeper to RDF Converter

This script extracts messages from a Beeper SQLite database and converts them to RDF triples.
"""

import sqlite3
import json
import os
import platform
from datetime import datetime
import sys
import re
import argparse
from pathlib import Path

def sanitize_text(text):
    """Sanitize text for RDF format while preserving non-ASCII characters."""
    if text is None:
        return ""
    text = str(text)
    text = ''.join(ch for ch in text if ord(ch) >= 32 or ch == '\n')
    text = text.replace('"', '\\"')
    text = text.replace('\\', '\\\\')
    text = text.replace('\n', ' ')
    text = text.replace('\r', ' ')
    text = text.replace('\t', ' ')
    return text

def get_user_info(cursor, user_id):
    """Get user information from the database."""
    try:
        cursor.execute("SELECT json_extract(user, '$') FROM users WHERE userID = ?", (user_id,))
        result = cursor.fetchone()
        if result and result[0]:
            user_data = json.loads(result[0])
            name = user_data.get('fullName', user_id)
            return name
        return user_id
    except (sqlite3.Error, json.JSONDecodeError, TypeError, KeyError) as e:
        print(f"Warning: Could not get user info for {user_id}: {e}")
        return user_id

def get_thread_info(cursor, thread_id):
    """Get thread information from the database."""
    try:
        cursor.execute("SELECT json_extract(thread, '$.title') FROM threads WHERE threadID = ?", (thread_id,))
        result = cursor.fetchone()
        if result and result[0]:
            return result[0]
        return thread_id
    except (sqlite3.Error, json.JSONDecodeError, TypeError, KeyError) as e:
        print(f"Warning: Could not get thread info for {thread_id}: {e}")
        return thread_id

def get_default_db_path():
    """Get the default Beeper SQLite database path based on the platform."""
    system = platform.system()
    if system == "Darwin":  # macOS
        return Path.home() / "Library" / "Application Support" / "BeeperTexts" / "index.db"
    elif system == "Windows":
        return Path.home() / "AppData" / "Roaming" / "BeeperTexts" / "index.db"
    else:  # Linux and others
        return Path.home() / ".config" / "BeeperTexts" / "index.db"

def extract_messages_to_rdf(db_path, output_file, limit=10000):
    """Extract messages from Beeper SQLite database and convert to RDF format."""
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print(f"Extracting up to {limit} messages from Beeper SQLite database...")

        # Get messages with text content from the database
        cursor.execute("""
            SELECT
                roomID,
                senderContactID,
                json_extract(message, '$.text') as message_text,
                timestamp,
                eventID
            FROM mx_room_messages
            WHERE type = 'TEXT'
            AND json_extract(message, '$.text') IS NOT NULL
            AND json_extract(message, '$.text') != ''
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))

        messages = cursor.fetchall()
        print(f"Found {len(messages)} messages with text content.")

        # Keep track of already created entities to avoid duplicates
        created_rooms = set()
        created_senders = set()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('@prefix : <https://metastate.dev/ontology/beeper/> .\n')
            f.write('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n')
            f.write('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n')
            f.write('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n')
            f.write('@prefix dc: <http://purl.org/dc/elements/1.1/> .\n\n')

            for message_index, (room_id, sender_id, text, timestamp, event_id) in enumerate(messages):
                if not text:
                    continue

                room_name = get_thread_info(cursor, room_id)
                room_id_safe = re.sub(r'[^a-zA-Z0-9_]', '_', room_id)

                sender_name = get_user_info(cursor, sender_id)
                sender_id_safe = re.sub(r'[^a-zA-Z0-9_]', '_', sender_id)

                event_id_safe = re.sub(r'[^a-zA-Z0-9_]', '_', event_id)

                timestamp_str = datetime.fromtimestamp(timestamp/1000).isoformat()

                f.write(f':message_{event_id_safe} rdf:type :Message ;\n')
                f.write(f'    :hasRoom :room_{room_id_safe} ;\n')
                f.write(f'    :hasSender :sender_{sender_id_safe} ;\n')
                f.write(f'    :hasContent "{sanitize_text(text)}" ;\n')
                f.write(f'    dc:created "{timestamp_str}"^^xsd:dateTime .\n\n')

                if room_id_safe not in created_rooms:
                    f.write(f':room_{room_id_safe} rdf:type :Room ;\n')
                    f.write(f'    rdfs:label "{sanitize_text(room_name)}" .\n\n')
                    created_rooms.add(room_id_safe)

                if sender_id_safe not in created_senders:
                    f.write(f':sender_{sender_id_safe} rdf:type :Person ;\n')
                    f.write(f'    rdfs:label "{sanitize_text(sender_name)}" .\n\n')
                    created_senders.add(sender_id_safe)

                if message_index % 100 == 0:
                    print(f"Processed {message_index} messages...")

            print(f"Successfully converted {len(messages)} messages to RDF format.")
            print(f"Output saved to {output_file}")

    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        if conn:
            conn.close()

    return True

def main():
    """Main function to parse arguments and run the extraction."""
    parser = argparse.ArgumentParser(description='Extract messages from Beeper database to RDF format')
    parser.add_argument('--output', '-o', default='beeper_messages.ttl',
                        help='Output RDF file (default: beeper_messages.ttl)')
    parser.add_argument('--limit', '-l', type=int, default=10000,
                        help='Maximum number of messages to extract (default: 10000)')
    parser.add_argument('--db-path', '-d',
                        default=str(get_default_db_path()),
                        help='Path to Beeper SQLite database file')
    parser.add_argument('--visualize', '-v', action='store_true',
                        help='Generate visualizations from the RDF data')
    parser.add_argument('--viz-dir', default='visualizations',
                        help='Directory to store visualizations (default: visualizations)')

    args = parser.parse_args()

    success = extract_messages_to_rdf(args.db_path, args.output, args.limit)

    if success and args.visualize:
        try:
            from beeper_viz import generate_visualizations
            print("\nGenerating visualizations from the RDF data...")
            generate_visualizations(args.output, args.viz_dir)
        except ImportError:
            print("\nWarning: Could not import visualization module. Make sure beeper_viz.py is in the same directory.")
            print("You can run visualizations separately with: python beeper_viz.py")

    return success

if __name__ == "__main__":
    if main():
        print("Beeper to RDF conversion completed successfully.")
    else:
        print("Failed to extract messages to RDF format.")
        sys.exit(1)
