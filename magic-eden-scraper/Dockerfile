FROM ubuntu:focal

ARG DEBIAN_FRONTEND=noninteractive

USER root

WORKDIR /root/magic-eden-scraper

RUN echo "===> Installing system dependencies..." && \
  BUILD_DEPS="curl unzip git openssh-server" && \
  apt-get update && apt-get install --no-install-recommends -y \
  python3 python3-pip python3-venv wget \
  fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
  libnspr4 libnss3 lsb-release xdg-utils libxss1 libdbus-glib-1-2 libgbm1 \
  $BUILD_DEPS \
  xvfb && \
  \
  echo "===> Installing chromedriver and google-chrome..." && \
  CHROMEDRIVER_VERSION=`curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE` && \
  wget https://chromedriver.storage.googleapis.com/$CHROMEDRIVER_VERSION/chromedriver_linux64.zip && \
  unzip chromedriver_linux64.zip -d /usr/bin && \
  chmod +x /usr/bin/chromedriver && \
  rm chromedriver_linux64.zip && \
  \
  CHROME_SETUP=google-chrome.deb && \
  wget -O $CHROME_SETUP "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb" && \
  dpkg -i $CHROME_SETUP && \
  apt-get install -y -f && \
  rm $CHROME_SETUP

ENV NVM_DIR=/root/.nvm

ENV NODE_VERSION=16.13.0

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}

RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}

RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}

ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

RUN npm i -g yarn

COPY . ./

RUN python3 -m venv env && . env/bin/activate && pip install -r requirements.txt

RUN cd metaplex-scripts && yarn

ENTRYPOINT ["/bin/bash", "-c", ". env/bin/activate && python scraper.py"]
