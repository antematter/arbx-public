using ArbX
using Documenter

DocMeta.setdocmeta!(ArbX, :DocTestSetup, :(using ArbX); recursive=true)

makedocs(;
    modules=[ArbX],
    authors="antematter",
    repo="https://github.com/antematter/arbx/tree/master/graph/ArbX",
    sitename="ArbX.jl",
    format=Documenter.HTML(;
        prettyurls=get(ENV, "CI", "false") == "true",
        canonical="https://github.com/antematter/arbx/tree/master/graph/ArbX",
        assets=String[],
    ),
    pages=[
        "Home" => "index.md",
        "ArbX (Main)" => "arbx.md",
        "Types" => "types.md",
        "Arbitrage" => "arbitrage.md",
        "DataFeeds" => "datafeeds.md",
    ],
)

deploydocs(;
    repo="https://github.com/antematter/arbx/tree/master/graph/ArbX",
    devbranch="master",
)
