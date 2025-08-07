#!/usr/bin/env python3
"""
Beeper Test Database Migration Script

Creates a SQLite database with dummy data that mimics the Beeper database structure
for testing the beeper_to_rdf.py script.
"""

import sqlite3
import json
import os
import time
from datetime import datetime
import argparse


def create_test_database(db_path="test_beeper.db"):
    """Create a test SQLite database with dummy Beeper data."""
    
    # Remove existing database if it exists
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Removed existing test database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create users table
        cursor.execute("""
            CREATE TABLE users (
                userID TEXT PRIMARY KEY,
                user TEXT
            )
        """)
        
        # Create threads table
        cursor.execute("""
            CREATE TABLE threads (
                threadID TEXT PRIMARY KEY,
                thread TEXT
            )
        """)
        
        # Create mx_room_messages table
        cursor.execute("""
            CREATE TABLE mx_room_messages (
                eventID TEXT PRIMARY KEY,
                roomID TEXT,
                senderContactID TEXT,
                type TEXT,
                message TEXT,
                timestamp INTEGER
            )
        """)
        
        print("Created database tables successfully.")
        
        # Insert test users
        test_users = [
            {
                "userID": "@alice:beeper.com",
                "user": json.dumps({
                    "fullName": "Alice Johnson",
                    "displayName": "Alice",
                    "avatar": "https://example.com/avatar1.jpg"
                })
            },
            {
                "userID": "@bob:beeper.com", 
                "user": json.dumps({
                    "fullName": "Bob Smith",
                    "displayName": "Bob",
                    "avatar": "https://example.com/avatar2.jpg"
                })
            },
            {
                "userID": "@charlie:beeper.com",
                "user": json.dumps({
                    "fullName": "Charlie Brown",
                    "displayName": "Charlie",
                    "avatar": "https://example.com/avatar3.jpg"
                })
            },
            {
                "userID": "@diana:beeper.com",
                "user": json.dumps({
                    "fullName": "Diana Prince", 
                    "displayName": "Diana",
                    "avatar": "https://example.com/avatar4.jpg"
                })
            }
        ]
        
        for user in test_users:
            cursor.execute("INSERT INTO users (userID, user) VALUES (?, ?)",
                         (user["userID"], user["user"]))
        
        print(f"Inserted {len(test_users)} test users.")
        
        # Insert test threads/rooms
        test_threads = [
            {
                "threadID": "!general:beeper.com",
                "thread": json.dumps({
                    "title": "General Discussion",
                    "topic": "General chat for the team",
                    "members": 4
                })
            },
            {
                "threadID": "!tech:beeper.com",
                "thread": json.dumps({
                    "title": "Tech Talk",
                    "topic": "Technology discussions and updates",
                    "members": 3
                })
            },
            {
                "threadID": "!random:beeper.com", 
                "thread": json.dumps({
                    "title": "Random",
                    "topic": "Random conversations and memes",
                    "members": 4
                })
            }
        ]
        
        for thread in test_threads:
            cursor.execute("INSERT INTO threads (threadID, thread) VALUES (?, ?)",
                         (thread["threadID"], thread["thread"]))
        
        print(f"Inserted {len(test_threads)} test threads.")
        
        # Insert test messages
        current_timestamp = int(time.time() * 1000)  # Current time in milliseconds
        
        test_messages = [
            # General Discussion messages
            {
                "eventID": "$event1:beeper.com",
                "roomID": "!general:beeper.com", 
                "senderContactID": "@alice:beeper.com",
                "type": "TEXT",
                "message": json.dumps({
                    "text": "Hello everyone! Welcome to our new chat system.",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 3600000  # 1 hour ago
            },
            {
                "eventID": "$event2:beeper.com",
                "roomID": "!general:beeper.com",
                "senderContactID": "@bob:beeper.com", 
                "type": "TEXT",
                "message": json.dumps({
                    "text": "Thanks Alice! This looks great. Looking forward to using it.",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 3500000
            },
            {
                "eventID": "$event3:beeper.com",
                "roomID": "!general:beeper.com",
                "senderContactID": "@charlie:beeper.com",
                "type": "TEXT", 
                "message": json.dumps({
                    "text": "Agreed! The interface is very intuitive. 🚀",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 3400000
            },
            
            # Tech Talk messages  
            {
                "eventID": "$event4:beeper.com",
                "roomID": "!tech:beeper.com",
                "senderContactID": "@alice:beeper.com",
                "type": "TEXT",
                "message": json.dumps({
                    "text": "What do you think about the new RDF conversion feature?",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 2700000
            },
            {
                "eventID": "$event5:beeper.com", 
                "roomID": "!tech:beeper.com",
                "senderContactID": "@diana:beeper.com",
                "type": "TEXT",
                "message": json.dumps({
                    "text": "It's really powerful! Being able to export chat data as semantic triples opens up so many possibilities for analysis.",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 2600000
            },
            {
                "eventID": "$event6:beeper.com",
                "roomID": "!tech:beeper.com",
                "senderContactID": "@bob:beeper.com",
                "type": "TEXT",
                "message": json.dumps({
                    "text": "The cross-platform database path detection is a nice touch too. Works on macOS, Windows, and Linux!",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 2500000
            },
            
            # Random messages
            {
                "eventID": "$event7:beeper.com",
                "roomID": "!random:beeper.com",
                "senderContactID": "@charlie:beeper.com", 
                "type": "TEXT",
                "message": json.dumps({
                    "text": "Anyone else excited about the weekend? 🎉",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 1800000
            },
            {
                "eventID": "$event8:beeper.com",
                "roomID": "!random:beeper.com",
                "senderContactID": "@diana:beeper.com",
                "type": "TEXT", 
                "message": json.dumps({
                    "text": "Definitely! Planning to work on some side projects. Maybe something with the RDF data we can export.",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 1700000
            },
            {
                "eventID": "$event9:beeper.com",
                "roomID": "!random:beeper.com",
                "senderContactID": "@alice:beeper.com",
                "type": "TEXT",
                "message": json.dumps({
                    "text": "That sounds great! Don't forget to test with unicode characters: こんにちは, مرحبا, Здравствуйте",
                    "msgtype": "m.text"  
                }),
                "timestamp": current_timestamp - 1600000
            },
            {
                "eventID": "$event10:beeper.com",
                "roomID": "!general:beeper.com",
                "senderContactID": "@bob:beeper.com",
                "type": "TEXT",
                "message": json.dumps({
                    "text": "Great point about unicode! The new sanitization preserves non-ASCII characters properly.",
                    "msgtype": "m.text"
                }),
                "timestamp": current_timestamp - 900000
            }
        ]
        
        for message in test_messages:
            cursor.execute("""
                INSERT INTO mx_room_messages 
                (eventID, roomID, senderContactID, type, message, timestamp) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                message["eventID"],
                message["roomID"], 
                message["senderContactID"],
                message["type"],
                message["message"],
                message["timestamp"]
            ))
        
        print(f"Inserted {len(test_messages)} test messages.")
        
        conn.commit()
        print(f"Successfully created test database: {db_path}")
        
        # Print some statistics
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM threads") 
        thread_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM mx_room_messages WHERE type = 'TEXT'")
        message_count = cursor.fetchone()[0]
        
        print(f"\nDatabase statistics:")
        print(f"- Users: {user_count}")
        print(f"- Threads: {thread_count}")
        print(f"- Text Messages: {message_count}")
        
        return True
        
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        conn.close()


def main():
    """Main function to parse arguments and create test database."""
    parser = argparse.ArgumentParser(description='Create test SQLite database with dummy Beeper data')
    parser.add_argument('--output', '-o', default='test_beeper.db',
                       help='Output database file (default: test_beeper.db)')
    
    args = parser.parse_args()
    
    success = create_test_database(args.output)
    
    if success:
        print(f"\nTest database created successfully!")
        print(f"You can now test the RDF conversion with:")
        print(f"python beeper_to_rdf.py --db-path {args.output} --output test_output.ttl --limit 20")
    else:
        print("Failed to create test database.")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())