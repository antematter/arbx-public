using RDKafka

conf = Dict(#"sasl_plain_password" => "w0rthl3ss",
            #"sasl_plain_username" => "w0rthl3ss",
            "bootstrap.servers" => "159.223.109.146",
            #"security.protocol" => "SASL_PLAINTEXT",
            #"sasl.mechanisms" => "PLAIN",
            "group.id" => "julia",
            #"auto.offset.reset" => "earliest"
            )

c = KafkaConsumer(conf)
parlist = [("Orca", 0)] 
subscribe(c, parlist)
timeout_ms = 1000
while true
    msg = poll(String, String, c, timeout_ms)
    @show(msg)
end