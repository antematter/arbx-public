use bincode::serialize;
use serde_json::json;
use solana_sdk::account::Account;
use solana_transaction_status::UiTransactionEncoding;
use std::borrow::Borrow;
use std::str::FromStr;

use actix_web::{web, App, HttpServer, Result};
use solana_address_lookup_table_program::{self, state::AddressLookupTable};
use solana_sdk::commitment_config::CommitmentLevel;
use solana_sdk::instruction::AccountMeta;
use solana_sdk::{
    self,
    address_lookup_table_account::AddressLookupTableAccount,
    commitment_config::CommitmentConfig,
    instruction::Instruction,
    message::{v0, VersionedMessage},
    pubkey::Pubkey,
    signature::{Keypair, Signature},
    signer::Signer,
    transaction::{Transaction, VersionedTransaction},
};

use solana_client::{
    rpc_client::RpcClient, rpc_config::RpcSendTransactionConfig, rpc_request::RpcRequest,
};

pub mod constants;
pub mod schema;

use constants::RPC_ENDPOINT;
use schema::TransactionPayload;
use schema::Response;
use std::thread;

use crate::schema::Key;

fn get_payer() -> Keypair {
    // let secret_key: [u8; 64] = [ //warren's key
    //     96, 31, 141, 43, 244, 27, 1, 1, 147, 103, 183, 32, 130, 146, 1, 125, 213, 249, 74, 222,
    //     237, 230, 88, 197, 227, 32, 184, 130, 203, 13, 112, 112, 157, 233, 153, 58, 6, 5, 69, 254,
    //     45, 129, 222, 132, 32, 17, 131, 191, 200, 170, 102, 70, 234, 67, 200, 127, 243, 40, 48, 69,
    //     132, 20, 140, 129,
    // ];
    let secret_key: [u8; 64] = [ //my own key
        131, 41, 233, 11, 72, 243, 13, 38, 145, 79, 129, 138, 250, 6, 243, 67, 73, 5, 188, 106, 90,
        96, 89, 148, 230, 208, 38, 16, 100, 204, 61, 11, 48, 238, 88, 45, 1, 118, 131, 255, 23,
        164, 15, 251, 122, 131, 18, 187, 255, 226, 54, 144, 192, 42, 76, 81, 158, 64, 14, 169, 39,
        211, 150, 33,
    ];
    return Keypair::from_bytes(&secret_key).unwrap();
}


fn create_swap_instructions(instrs: &web::Json<TransactionPayload>) -> Vec<Instruction> {
    let mut instructions = Vec::new();

    for item in instrs.instrs.iter() {
        let outer = &item.instructions;
        for ins in outer.iter() {
            let program_id: Pubkey = Pubkey::from_str(&ins.program_id).unwrap();
            let data = ins.data.clone();
            let mut keys = Vec::new();

            for key in &(ins.keys) {
                keys.push({
                    if key.is_writable {
                        AccountMeta::new(Pubkey::from_str(&key.pubkey).unwrap(), key.is_signer)
                    } else {
                        AccountMeta::new_readonly(
                            Pubkey::from_str(&key.pubkey).unwrap(),
                            key.is_signer,
                        )
                    }
                })
            }
            instructions.push(Instruction {
                program_id: program_id,
                accounts: keys,
                data: data,
            })
        }
    }
    instructions
}

fn create_lookup_table(rpc_client: &RpcClient, payer: &Keypair) -> Result<Pubkey> {
    let recent_slot = rpc_client
        .get_slot_with_commitment(CommitmentConfig::finalized())
        .unwrap();

    let (create_ix, table_pk) =
        solana_address_lookup_table_program::instruction::create_lookup_table(
            payer.pubkey(),
            payer.pubkey(),
            recent_slot,
        );

    let latest_blockhash = rpc_client.get_latest_blockhash().unwrap();
    rpc_client
        .send_and_confirm_transaction(&Transaction::new_signed_with_payer(
            &[create_ix],
            Some(&payer.pubkey()),
            &[payer],
            latest_blockhash,
        ))
        .unwrap();

    Ok(table_pk)
}

fn add_addresses_to_lut(
    rpc_client: &RpcClient,
    payer: &Keypair,
    lut_pk: &Pubkey,
    addresses: &Vec<Pubkey>,
) -> Result<()> {
    let mut signature = Signature::default();
    let latest_blockhash = rpc_client.get_latest_blockhash().unwrap();

    for selected_pool_keys in addresses.chunks(20) {
        let extend_ix = solana_address_lookup_table_program::instruction::extend_lookup_table(
            *lut_pk,
            payer.pubkey(),
            Some(payer.pubkey()),
            selected_pool_keys.to_vec(),
        );

        signature = rpc_client
            .send_and_confirm_transaction(&Transaction::new_signed_with_payer(
                &[extend_ix],
                Some(&payer.pubkey()),
                &[payer],
                latest_blockhash,
            ))
            .unwrap();
    }
    rpc_client
        .confirm_transaction_with_spinner(
            &signature,
            &latest_blockhash,
            CommitmentConfig::finalized(),
        )
        .unwrap();

    Ok(())
}

fn create_tx_with_address_table_lookup(
    client: &RpcClient,
    instructions: &[Instruction],
    address_lookup_table_key: &Pubkey,
    payer: &Keypair,
) -> Result<VersionedTransaction> {
    let raw_account = client.get_account(&address_lookup_table_key).unwrap();
    let address_lookup_table = AddressLookupTable::deserialize(&raw_account.data).unwrap();
    let address_lookup_table_account = AddressLookupTableAccount {
        key: *address_lookup_table_key,
        addresses: address_lookup_table.addresses.to_vec(),
    };

    let blockhash = client.get_latest_blockhash().unwrap();

    // VersionedTransaction
    let tx = VersionedTransaction::try_new(
        VersionedMessage::V0(
            v0::Message::try_compile(
                &payer.pubkey(),
                instructions,
                &[address_lookup_table_account],
                blockhash,
            )
            .unwrap(),
        ),
        &[payer],
    )
    .unwrap();
    assert!(tx.message.address_table_lookups().unwrap().len() > 0);
    Ok(tx)
}

fn execute_transaction(rpc_client: &RpcClient, tx: &VersionedTransaction) -> Result<String> {
    let serialized_versioned_tx = serialize(&tx).unwrap();
    println!(
        "The serialized versioned tx is {} bytes",
        serialized_versioned_tx.len()
    );

    let serialized_encoded = base64::encode(serialized_versioned_tx);
    let config = RpcSendTransactionConfig {
        skip_preflight: false,
        preflight_commitment: Some(CommitmentLevel::Processed),
        encoding: Some(UiTransactionEncoding::Base64),
        ..RpcSendTransactionConfig::default()
    };

    let signature = rpc_client
        .send::<String>(
            RpcRequest::SendTransaction,
            json!([serialized_encoded, config]),
        )
        .unwrap();
    
    println!("Multi swap txid: {}", signature);

    rpc_client
        .confirm_transaction_with_commitment(
            &Signature::from_str(signature.as_str()).unwrap(),
            CommitmentConfig::finalized(),
        )
        .unwrap();
    
    Ok(signature.to_string())
}

async fn swap(instrs: web::Json<TransactionPayload>) -> Result<String> {
    let tx_sig = thread::spawn(move || {
        let instructions = create_swap_instructions(&instrs);

        println!("Created Swap instructions");
        let payer = get_payer();
        let rpc_client =
            RpcClient::new_with_commitment(RPC_ENDPOINT, CommitmentConfig::confirmed());
        let lut_pk = create_lookup_table(rpc_client.borrow(), payer.borrow()).unwrap();
        println!("Created Lookup Table");

        let lut_addresses = instrs
            .lut_addresses
            .iter()
            .map(|key| Pubkey::from_str(key.borrow()).unwrap())
            .collect::<Vec<Pubkey>>();

        add_addresses_to_lut(&rpc_client, &payer, &lut_pk, &lut_addresses).unwrap();
        println!("Added addresses to Lookup Table");

        let tx: VersionedTransaction =
            create_tx_with_address_table_lookup(&rpc_client, &instructions, &lut_pk, &payer)
                .unwrap();
        println!("Created Versioned Transaction");

        execute_transaction(&rpc_client, &tx).unwrap()        
    })
    .join()
    .unwrap();
    let res: Response = Response{Signature: tx_sig};
    Ok(serde_json::to_string(&res).unwrap())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {

    println!("Executing incoming Arbs on endpoint: {}", RPC_ENDPOINT);

    HttpServer::new(|| App::new().route("/swap", web::post().to(swap)))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}
