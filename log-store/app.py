import os
import uuid
import boto3
from flask import Flask, jsonify, make_response, request

app = Flask(__name__)


dynamodb_client = boto3.client('dynamodb')
LOGS_TABLE = os.environ['LOGS_TABLE']


# if os.environ.get('IS_OFFLINE'):
#     dynamodb_client = boto3.client(
#         'dynamodb', region_name='localhost', endpoint_url='http://localhost:8000'
#     )


@app.route('/tx-logs', methods=['POST'])
def create_user():
    pubkey = request.json.get('pubkey')
    txid = request.json.get('txid')
    if not pubkey or not txid:
        return jsonify({'error': 'invalid payload'}), 400

    pk = str(uuid.uuid4())
    record = {
        "uuid":pk,
        "pubkey": pubkey,
        "signature": txid
    }

    dynamodb = boto3.resource('dynamodb')
    log_table = os.environ['LOGS_TABLE']
    table = dynamodb.Table(log_table)


    response = table.put_item(
        Item=record
    )
    
    return jsonify({'message' : 'ok'})


@app.errorhandler(404)
def resource_not_found(e):
    return make_response(jsonify(error='Not found!'), 404)
