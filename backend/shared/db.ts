import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export const TABLE_NAME = process.env.TABLE_NAME || 'TimeTrackingApp';

// Helper functions for DynamoDB operations
export const db = {
  get: async (pk: string, sk: string) => {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
      })
    );
    return result.Item;
  },

  put: async (item: Record<string, any>) => {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );
    return item;
  },

  update: async (
    pk: string,
    sk: string,
    updates: Record<string, any>
  ): Promise<Record<string, any>> => {
    const updateExpression = 'SET ' + Object.keys(updates).map((key, i) => `#${key} = :${key}`).join(', ');
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
      acc[`#${key}`] = key;
      return acc;
    }, {} as Record<string, string>);
    const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
      acc[`:${key}`] = updates[key];
      return acc;
    }, {} as Record<string, any>);

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes || {};
  },

  delete: async (pk: string, sk: string) => {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
      })
    );
  },

  query: async (
    pk: string,
    skCondition?: { begins?: string; equals?: string; between?: [string, string] },
    indexName?: string
  ) => {
    let keyConditionExpression = indexName ? 'GSI1PK = :pk' : 'PK = :pk';
    const expressionAttributeValues: Record<string, any> = { ':pk': pk };

    if (skCondition) {
      if (skCondition.begins) {
        keyConditionExpression += indexName ? ' AND begins_with(GSI1SK, :sk)' : ' AND begins_with(SK, :sk)';
        expressionAttributeValues[':sk'] = skCondition.begins;
      } else if (skCondition.equals) {
        keyConditionExpression += indexName ? ' AND GSI1SK = :sk' : ' AND SK = :sk';
        expressionAttributeValues[':sk'] = skCondition.equals;
      } else if (skCondition.between) {
        keyConditionExpression += indexName ? ' AND GSI1SK BETWEEN :sk1 AND :sk2' : ' AND SK BETWEEN :sk1 AND :sk2';
        expressionAttributeValues[':sk1'] = skCondition.between[0];
        expressionAttributeValues[':sk2'] = skCondition.between[1];
      }
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    return result.Items || [];
  },

  queryGSI2: async (
    pk: string,
    skCondition?: { begins?: string; equals?: string; between?: [string, string] }
  ) => {
    let keyConditionExpression = 'GSI2PK = :pk';
    const expressionAttributeValues: Record<string, any> = { ':pk': pk };

    if (skCondition) {
      if (skCondition.begins) {
        keyConditionExpression += ' AND begins_with(GSI2SK, :sk)';
        expressionAttributeValues[':sk'] = skCondition.begins;
      } else if (skCondition.equals) {
        keyConditionExpression += ' AND GSI2SK = :sk';
        expressionAttributeValues[':sk'] = skCondition.equals;
      } else if (skCondition.between) {
        keyConditionExpression += ' AND GSI2SK BETWEEN :sk1 AND :sk2';
        expressionAttributeValues[':sk1'] = skCondition.between[0];
        expressionAttributeValues[':sk2'] = skCondition.between[1];
      }
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    return result.Items || [];
  },
};
