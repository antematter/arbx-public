# ArbX

[![Stable](https://img.shields.io/badge/docs-stable-blue.svg)](https://thall.github.io/ArbX.jl/stable)
[![Dev](https://img.shields.io/badge/docs-dev-blue.svg)](https://thall.github.io/ArbX.jl/dev)

# ArbX.jl 

The graph module of `ArbX`. 

## Julia Installation 

https://www.digitalocean.com/community/tutorials/how-to-install-julia-programming-language-on-ubuntu-22-04

## Usage

**Note: Launch Julia with multiple threads using `julia --threads auto`.**

```julia
julia> include("src/publisher.jl")
```

Then wait for arbs. 

## Documentation

For privacy reasons, the docs have to be built manually. This is pretty simple. Inside the Julia REPL, just run the following command: 
```julia
julia> include("docs/make.jl")
```

This will generate the docs inside the `docs/build` directory. Navigate to the `build` then open `index.html`. Now read.