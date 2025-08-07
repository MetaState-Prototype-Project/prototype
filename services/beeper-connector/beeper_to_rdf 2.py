#!/usr/bin/env python3
"""
Beeper to RDF Converter

This script extracts messages from a Beeper database and converts them to RDF triples.
"""

import sqlite3
import json
import os
from datetime import datetime
import sys
import re
import argparse

def sanitize_text(text):
    """Sanitize text for RDF format."""
    if text is None:
        return ""
    # Replace quotes and escape special characters
    text = str(text)
    # Remove any control characters
    text = ''.join(ch for ch in text if ord(ch) >= 32 or ch == '\n')
    # Replace problematic characters
    text = text.replace('"', '\\"')
    text = text.replace('\\', '\\\\')
    text = text.replace('\n', ' ')
    text = text.replace('\r', ' ')
    text = text.replace('\t', ' ')
    # Remove any other characters that might cause issues
    text = ''.join(ch for ch in text if ord(ch) < 128)
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
    except:
        return user_id

def get_thread_info(cursor, thread_id):
    """Get thread information from the database."""
    try:
        cursor.execute("SELECT json_extract(thread, '$.title') FROM threads WHERE threadID = ?", (thread_id,))
        result = cursor.fetchone()
        if result and result[0]:
            return result[0]
        return thread_id
    except:
        return thread_id

def extract_messages_to_rdf(db_path, output_file, limit=10000):
    """Extract messages from Beeper database and convert to RDF format."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print(f"Extracting up to {limit} messages from Beeper database...")

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

        with open(output_file, 'w', encoding='utf-8') as f:
            # Write RDF header
            f.write('@prefix : <http://example.org/beeper/> .\n')
            f.write('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n')
            f.write('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n')
            f.write('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n')
            f.write('@prefix dc: <http://purl.org/dc/elements/1.1/> .\n\n')

            # Process each message and write RDF triples
            for i, (room_id, sender_id, text, timestamp, event_id) in enumerate(messages):
                if not text:
                    continue

                # Process room ID
                room_name = get_thread_info(cursor, room_id)
                room_id_safe = re.sub(r'[^a-zA-Z0-9_]', '_', room_id)

                # Process sender ID
                sender_name = get_user_info(cursor, sender_id)
                sender_id_safe = re.sub(r'[^a-zA-Z0-9_]', '_', sender_id)

                # Create a safe event ID
                event_id_safe = re.sub(r'[^a-zA-Z0-9_]', '_', event_id)

                # Format timestamp
                timestamp_str = datetime.fromtimestamp(timestamp/1000).isoformat()

                # Generate RDF triples
                f.write(f':message_{event_id_safe} rdf:type :Message ;\n')
                f.write(f'    :hasRoom :room_{room_id_safe} ;\n')
                f.write(f'    :hasSender :sender_{sender_id_safe} ;\n')
                f.write(f'    :hasContent "{sanitize_text(text)}" ;\n')
                f.write(f'    dc:created "{timestamp_str}"^^xsd:dateTime .\n\n')

                # Create room triples if not already created
                f.write(f':room_{room_id_safe} rdf:type :Room ;\n')
                f.write(f'    rdfs:label "{sanitize_text(room_name)}" .\n\n')

                # Create sender triples if not already created
                f.write(f':sender_{sender_id_safe} rdf:type :Person ;\n')
                f.write(f'    rdfs:label "{sanitize_text(sender_name)}" .\n\n')

                if i % 100 == 0:
                    print(f"Processed {i} messages...")

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
                        default=os.path.expanduser("~/Library/Application Support/BeeperTexts/index.db"),
                        help='Path to Beeper database file')
    parser.add_argument('--visualize', '-v', action='store_true',
                        help='Generate visualizations from the RDF data')
    parser.add_argument('--viz-dir', default='visualizations',
                        help='Directory to store visualizations (default: visualizations)')

    args = parser.parse_args()

    # Extract messages to RDF
    success = extract_messages_to_rdf(args.db_path, args.output, args.limit)

    if success and args.visualize:
        try:
            # Import visualization module
            from beeper_viz import generate_visualizations
            print("\nGenerating visualizations from the RDF data...")
            generate_visualizations(args.output, args.viz_dir)
        except ImportError:
            print("\nWarning: Could not import visualization module. Make sure beeper_viz.py is in the same directory.")
            print("You can run visualizations separately with: python beeper_viz.py")

    return success

if __name__ == "__main__":
    # Run the main function
    if main():
        print("Beeper to RDF conversion completed successfully.")
    else:
        print("Failed to extract messages to RDF format.")
        sys.exit(1)
