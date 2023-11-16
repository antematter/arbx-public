FROM ubuntu:focal

WORKDIR /arbx

RUN apt-get update && apt-get upgrade -y && apt-get install -y wget

RUN wget https://julialang-s3.julialang.org/bin/linux/x64/1.8/julia-1.8.0-linux-x86_64.tar.gz && \
  tar -xvzf julia-1.8.0-linux-x86_64.tar.gz && \
  rm julia-1.8.0-linux-x86_64.tar.gz && \
  mv julia-1.8.0 /opt && \
  ln -s /opt/julia-1.8.0/bin/julia /usr/local/bin/julia

COPY packages.jl ./

RUN julia packages.jl

COPY data_loader.jl pairs.jl pair_backup.txt ./

CMD ["julia", "pairs.jl"]