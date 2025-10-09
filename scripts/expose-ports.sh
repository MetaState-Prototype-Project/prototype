#!/bin/bash

MINIKUBE_IP="192.168.49.2"
START_PORT=30000
END_PORT=32767

for ((port = $START_PORT; port <= $END_PORT; port++)); do
    echo "Forwarding port $port to $MINIKUBE_IP:$port"
    nohup socat TCP4-LISTEN:$port,fork TCP4:$MINIKUBE_IP:$port >/dev/null 2>&1 &
done
