FROM node:16

WORKDIR /app

ENV RPC_URL=https://solana-mainnet.g.alchemy.com/v2/kd3xkS82akAM_EGtIw41LqrZdA2Vxhpe

# Install TypeScript and ts-node globally
RUN npm install typescript ts-node

# Copy package.json and install dependencies for orca
COPY ./orca/package.json ./orca/
RUN cd orca && npm install
RUN cd ..

# Copy package.json and install dependencies for raydium
# COPY raydium/package.json ./raydium/
# RUN cd raydium && npm install
# RUN cd ..

# Copy package.json and install dependencies for saber
COPY saber/package.json ./saber/
RUN cd saber && npm install
RUN cd ..

# # Copy package.json and install dependencies for whirlpool
COPY whirlpool/package.json ./whirlpool/
RUN cd whirlpool && npm install
RUN cd ..

# # Copy the source code for all three folders
COPY . .

# # Startup script to run commands for each folder
CMD ["bash", "-c", "npm start --prefix ./orca/ & npm start --prefix ./saber/ & npm start --prefix ./whirlpool/"]


