using RDKafka
import RDKafka.produce

conf = Dict(#"sasl_plain_password" => "w0rthl3ss",
            #"sasl_plain_username" => "w0rthl3ss",
            "bootstrap.servers" => "159.223.109.146",
            #"security.protocol" => "SASL_PLAINTEXT",
            #"sasl.mechanisms" => "PLAIN",
            #"group.id" => "julia",
            #"auto.offset.reset" => "earliest"
            )

p = KafkaProducer(conf)
partition = 0
produce(p, "test", partition, "message key", "message payload")