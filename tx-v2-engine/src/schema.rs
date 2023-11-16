use serde_derive::Deserialize;
use serde_derive::Serialize;
use serde_json::Value;

// pub type SwapInstructions = Vec<SwapInstruction>;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionPayload {
    pub instrs: Vec<SwapInstruction>,
    #[serde(rename = "lut_addresses")]
    pub lut_addresses: Vec<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapInstruction {
    pub recent_blockhash: Value,
    pub fee_payer: Value,
    pub nonce_info: Value,
    pub instructions: Vec<Instruction>,
    pub signers: Vec<Value>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instruction {
    pub keys: Vec<Key>,
    pub program_id: String,
    pub data: Vec<u8>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Key {
    pub pubkey: String,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[derive(Deserialize,Serialize)]
pub struct Response {
  pub Signature: String,
}