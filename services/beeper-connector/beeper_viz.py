#!/usr/bin/env python3
"""
Beeper RDF Visualization

This script generates visualizations from the RDF data extracted from Beeper.
"""

import matplotlib.pyplot as plt
import networkx as nx
import rdflib
from collections import Counter, defaultdict
import os
import sys
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from wordcloud import WordCloud
import matplotlib.dates as mdates

def load_rdf_data(file_path):
    """Load RDF data from a file."""
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return None

    print(f"Loading RDF data from {file_path}...")
    g = rdflib.Graph()
    g.parse(file_path, format="turtle")
    print(f"Loaded {len(g)} triples.")
    return g

def create_network_graph(g, output_file="network_graph.png", limit=50):
    """Create a network graph visualization of the RDF data."""
    print("Creating network graph visualization...")

    # Create a new NetworkX graph
    G = nx.Graph()

    # Get senders with most messages
    sender_counts = defaultdict(int)
    for subject, predicate, sender_object in g.triples((None, rdflib.URIRef("http://example.org/beeper/hasSender"), None)):
        sender_counts[str(sender_object)] += 1

    top_senders = [sender for sender, count in sorted(sender_counts.items(), key=lambda x: x[1], reverse=True)[:limit//2]]

    # Get rooms with most messages
    room_counts = defaultdict(int)
    for subject, predicate, room_object in g.triples((None, rdflib.URIRef("http://example.org/beeper/hasRoom"), None)):
        room_counts[str(room_object)] += 1

    top_rooms = [room for room, count in sorted(room_counts.items(), key=lambda x: x[1], reverse=True)[:limit//2]]

    # Add nodes for top senders and rooms
    for sender in top_senders:
        # Get sender label
        for subject, predicate, label_object in g.triples((rdflib.URIRef(sender), rdflib.RDFS.label, None)):
            sender_label = str(label_object)
            break
        else:
            sender_label = sender.split('_')[-1]

        G.add_node(sender, type='sender', label=sender_label, size=sender_counts[sender])

    for room in top_rooms:
        # Get room label
        for subject, predicate, label_object in g.triples((rdflib.URIRef(room), rdflib.RDFS.label, None)):
            room_label = str(label_object)
            break
        else:
            room_label = room.split('_')[-1]

        G.add_node(room, type='room', label=room_label, size=room_counts[room])

    # Add edges between senders and rooms
    for sender in top_senders:
        for message_subject, predicate, sender_object in g.triples((None, rdflib.URIRef("http://example.org/beeper/hasSender"), rdflib.URIRef(sender))):
            message = message_subject
            for msg_subject, msg_predicate, room_object in g.triples((message, rdflib.URIRef("http://example.org/beeper/hasRoom"), None)):
                room = str(room_object)
                if room in top_rooms:
                    if G.has_edge(sender, room):
                        G[sender][room]['weight'] += 1
                    else:
                        G.add_edge(sender, room, weight=1)

    # Create the visualization
    plt.figure(figsize=(16, 12))
    pos = nx.spring_layout(G, seed=42)

    # Draw nodes based on type
    sender_nodes = [node for node in G.nodes if G.nodes[node].get('type') == 'sender']
    room_nodes = [node for node in G.nodes if G.nodes[node].get('type') == 'room']

    # Node sizes based on message count
    sender_sizes = [G.nodes[node].get('size', 100) * 5 for node in sender_nodes]
    room_sizes = [G.nodes[node].get('size', 100) * 5 for node in room_nodes]

    # Draw sender nodes
    nx.draw_networkx_nodes(G, pos, nodelist=sender_nodes, node_size=sender_sizes,
                         node_color='lightblue', alpha=0.8, label='Senders')

    # Draw room nodes
    nx.draw_networkx_nodes(G, pos, nodelist=room_nodes, node_size=room_sizes,
                         node_color='lightgreen', alpha=0.8, label='Rooms')

    # Draw edges with width based on weight
    edges = G.edges()
    weights = [G[u][v]['weight'] * 0.1 for u, v in edges]
    nx.draw_networkx_edges(G, pos, width=weights, alpha=0.5, edge_color='gray')

    # Draw labels for nodes
    nx.draw_networkx_labels(G, pos, {node: G.nodes[node].get('label', node.split('_')[-1])
                                   for node in G.nodes}, font_size=8)

    plt.title('Beeper Message Network - Senders and Rooms')
    plt.legend()
    plt.axis('off')

    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Network graph saved to {output_file}")
    return True

def create_message_timeline(g, output_file="message_timeline.png"):
    """Create a timeline visualization of message frequency."""
    print("Creating message timeline visualization...")

    # Extract timestamps from the graph
    timestamps = []
    for subject, predicate, timestamp_object in g.triples((None, rdflib.URIRef("http://purl.org/dc/elements/1.1/created"), None)):
        try:
            timestamp = str(timestamp_object).replace('^^http://www.w3.org/2001/XMLSchema#dateTime', '').strip('"')
            timestamps.append(datetime.fromisoformat(timestamp))
        except (ValueError, TypeError):
            continue

    if not timestamps:
        print("Error: No valid timestamps found in the data.")
        return False

    # Convert to pandas Series for easier analysis
    ts_series = pd.Series(timestamps)

    # Create the visualization
    plt.figure(figsize=(16, 8))

    # Group by day and count
    ts_counts = ts_series.dt.floor('D').value_counts().sort_index()

    # Plot the timeline
    plt.plot(ts_counts.index, ts_counts.values, '-o', markersize=4)

    # Format the plot
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.gca().xaxis.set_major_locator(mdates.DayLocator(interval=30))  # Show every 30 days
    plt.gcf().autofmt_xdate()

    plt.title('Message Activity Timeline')
    plt.xlabel('Date')
    plt.ylabel('Number of Messages')
    plt.grid(True, alpha=0.3)

    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Timeline visualization saved to {output_file}")
    return True

def create_wordcloud(g, output_file="wordcloud.png", min_length=4, max_words=200):
    """Create a word cloud visualization of message content."""
    print("Creating word cloud visualization...")

    # Extract message content from the graph
    texts = []
    for subject, predicate, content_object in g.triples((None, rdflib.URIRef("http://example.org/beeper/hasContent"), None)):
        text = str(content_object)
        if text:
            texts.append(text)

    if not texts:
        print("Error: No message content found in the data.")
        return False

    # Combine all texts
    all_text = " ".join(texts)

    # Create the word cloud
    wordcloud = WordCloud(
        width=1200,
        height=800,
        background_color='white',
        max_words=max_words,
        collocations=False,
        min_word_length=min_length
    ).generate(all_text)

    # Create the visualization
    plt.figure(figsize=(16, 10))
    plt.imshow(wordcloud, interpolation='bilinear')
    plt.axis("off")
    plt.title('Most Common Words in Messages')

    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Word cloud saved to {output_file}")
    return True

def create_sender_activity(g, output_file="sender_activity.png", top_n=15):
    """Create a bar chart of sender activity."""
    print("Creating sender activity visualization...")

    # Count messages per sender
    sender_counts = defaultdict(int)
    sender_labels = {}

    for subject, predicate, sender_object in g.triples((None, rdflib.URIRef("http://example.org/beeper/hasSender"), None)):
        sender = str(sender_object)
        sender_counts[sender] += 1

        # Get the sender label
        for label_subject, label_predicate, label_object in g.triples((rdflib.URIRef(sender), rdflib.RDFS.label, None)):
            sender_labels[sender] = str(label_object)
            break

    # Sort senders by message count
    top_senders = sorted(sender_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]

    # Create the visualization
    plt.figure(figsize=(14, 8))

    # Use sender labels when available
    labels = [sender_labels.get(sender, sender.split('_')[-1]) for sender, _ in top_senders]
    values = [count for _, count in top_senders]

    # Create horizontal bar chart
    bars = plt.barh(labels, values, color='skyblue')

    # Add count labels to the bars
    for bar in bars:
        width = bar.get_width()
        plt.text(width + 5, bar.get_y() + bar.get_height()/2,
                 f'{int(width)}', ha='left', va='center')

    plt.title('Most Active Senders')
    plt.xlabel('Number of Messages')
    plt.ylabel('Sender')
    plt.tight_layout()

    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Sender activity chart saved to {output_file}")
    return True

def generate_visualizations(rdf_file, output_dir="visualizations"):
    """Generate all visualizations for the RDF data."""
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Load the RDF data
    g = load_rdf_data(rdf_file)
    if g is None:
        return False

    # Generate visualizations
    network_file = os.path.join(output_dir, "network_graph.png")
    timeline_file = os.path.join(output_dir, "message_timeline.png")
    wordcloud_file = os.path.join(output_dir, "wordcloud.png")
    activity_file = os.path.join(output_dir, "sender_activity.png")

    success = True
    success = create_network_graph(g, network_file) and success
    success = create_message_timeline(g, timeline_file) and success
    success = create_wordcloud(g, wordcloud_file) and success
    success = create_sender_activity(g, activity_file) and success

    if success:
        print(f"All visualizations generated successfully in {output_dir}/")
    else:
        print("Some visualizations could not be generated.")

    return success

if __name__ == "__main__":
    # Default input file
    rdf_file = "beeper_messages.ttl"
    output_dir = "visualizations"

    # Process command line arguments
    if len(sys.argv) > 1:
        rdf_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]

    # Generate visualizations
    generate_visualizations(rdf_file, output_dir)