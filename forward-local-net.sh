#!/bin/bash

# Find Minikube IP
MINIKUBE_IP=$(minikube ip)

# Find all NodePort services with their ports
echo "[INFO] Fetching all NodePort services..."
NODEPORTS=$(kubectl get svc --all-namespaces \
    -o jsonpath='{range .items[?(@.spec.type=="NodePort")]}{.metadata.namespace} {.metadata.name} {.spec.ports[*].nodePort}{"\n"}{end}')

# Loop through services and ports
while read -r line; do
    NAMESPACE=$(echo "$line" | awk '{print $1}')
    NAME=$(echo "$line" | awk '{print $2}')
    PORTS=$(echo "$line" | cut -d' ' -f3-)

    for PORT in $PORTS; do
        echo "[FORWARDING] $NAMESPACE/$NAME on port $PORT"

        # Check if socat already listening
        if lsof -i TCP:$PORT >/dev/null; then
            echo "   [SKIP] Port $PORT already in use locally"
        else
            # Run socat in background
            socat TCP4-LISTEN:$PORT,fork TCP4:$MINIKUBE_IP:$PORT &
            echo "   [OK] Forwarded port $PORT from Minikube to local"
        fi
    done
done <<<"$NODEPORTS"
