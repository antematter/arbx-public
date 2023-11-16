#!/bin/sh

# Usage
# sudo -E ./run.sh

if [ -z "$METAPLEX_PRIVATE_KEY" ]; then
  echo "Please set the environment variable METAPLEX_PRIVATE_KEY"
  exit 1
fi

if [ -z "$SSH_AUTH_SOCK" ]; then
  echo "SSH_AUTH_SOCK is not set. Please run ssh-agent and add your private key for mint-api.worthlesspixels.com"
  exit 1
fi

ssh -q -o BatchMode=yes -o StrictHostKeyChecking=no antematter@mint-api.worthlesspixels.com exit
if [ $? -ne 0 ]; then
  echo "SSH connection to mint-api.worthlesspixels.com could not be established. Please check your SSH key."
  exit 1
fi

if ! docker image inspect worthlesspixels/magic-eden-scraper:latest > /dev/null 2>&1; then
  docker build -t worthlesspixels/magic-eden-scraper:latest .
fi

docker run -d \
  -e METAPLEX_PRIVATE_KEY="$METAPLEX_PRIVATE_KEY" \
  -e SSH_AUTH_SOCK=/ssh-agent \
  -v $SSH_AUTH_SOCK:/ssh-agent \
  --shm-size=2g \
  worthlesspixels/magic-eden-scraper:latest