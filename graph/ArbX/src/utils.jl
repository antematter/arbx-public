using XLSX
using DataFrames

function getdata()::DataFrame
    data = XLSX.readxlsx("data/Pair Addresses.xlsx")["Pair"]
    df = DataFrame([name => [] for name in ["Token1", "Token2", "Market Address",
        "Market", "Token1 Address", "Token2 Address"]])
    local market
    for row in XLSX.eachrow(data)
        !ismissing(row[1]) || continue
        if occursin("Pair", row[1])
            market = split(row[1], " ")[1] |> String
            continue
        end
        push!(df, [(split(row[1], "-") |> Vector{String})..., row[2], market, row[3], row[4]])
    end
    return df
end

function gettokens(df::DataFrame)::Vector{String}
    return sort(unique([df.Token1..., df.Token2...]))
end

function loadvalidpairs(filepath::String)
    open(filepath, "r") do f
        data = readlines(f)
        return data
    end
end

# Stolen from https://stackoverflow.com/a/50900113/16629677
function uniqueidx(x::AbstractArray{T}) where {T}
    uniqueset = Set{T}()
    ex = eachindex(x)
    idxs = Vector{eltype(ex)}()
    for i in ex
        xi = x[i]
        if !(xi in uniqueset)
            push!(idxs, i)
            push!(uniqueset, xi)
        end
    end
    idxs
end