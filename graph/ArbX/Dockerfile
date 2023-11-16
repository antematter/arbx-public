FROM ubuntu:focal

WORKDIR /arbx

RUN apt-get update -y && apt-get upgrade -y && apt-get install -y wget

RUN wget https://julialang-s3.julialang.org/bin/linux/x64/1.8/julia-1.8.0-linux-x86_64.tar.gz && \
  tar -xvzf julia-1.8.0-linux-x86_64.tar.gz && \
  rm julia-1.8.0-linux-x86_64.tar.gz && \
  mv julia-1.8.0 /opt && \
  ln -s /opt/julia-1.8.0/bin/julia /usr/local/bin/julia

RUN apt-get install -y curl && \
  curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
  apt-get install -y nodejs && \
  npm install -g yarn

RUN apt-get install -y git

COPY . .

RUN cd metaplex-scripts && yarn

RUN julia --project=@. -e 'using Pkg; Pkg.instantiate();'

CMD [ "julia", "--threads", "auto", "--project=@.", "-e", "using Pkg; Pkg.instantiate(); include(\"src/publisher.jl\")" ]