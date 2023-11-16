module AMMs 

export RAY, SRM, Whirlpool, ORCA, Aldrin, Lifinity, Dooar, Saros 
export getmarketaddress

abstract type AMM end 

struct RAY <: AMM end 
struct SRM <: AMM end 
struct Whirlpool <: AMM end 
struct ORCA <: AMM end 
struct Aldrin <: AMM end 
struct Lifinity <: AMM end 
struct Dooar <: AMM end 
struct Saros <: AMM end

function getmarketaddress(::AMM) end 


end 