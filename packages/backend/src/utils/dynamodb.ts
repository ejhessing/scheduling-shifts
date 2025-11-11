import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
export const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

const TABLE_NAME = process.env.TABLE_NAME || 'TimeTrackingApp';

export interface DynamoDBItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  [key: string]: any;
}

/**
 * Put an item in DynamoDB
 */
export async function putItem(item: DynamoDBItem): Promise<void> {
  await dynamoDb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

/**
 * Get an item from DynamoDB
 */
export async function getItem(PK: string, SK: string): Promise<DynamoDBItem | null> {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK },
    })
  );

  return (result.Item as DynamoDBItem) || null;
}

/**
 * Update an item in DynamoDB
 */
export async function updateItem(
  PK: string,
  SK: string,
  updates: Record<string, any>
): Promise<DynamoDBItem> {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    const nameKey = `#attr${index}`;
    const valueKey = `:val${index}`;
    updateExpressions.push(`${nameKey} = ${valueKey}`);
    expressionAttributeNames[nameKey] = key;
    expressionAttributeValues[valueKey] = value;
  });

  const result = await dynamoDb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes as DynamoDBItem;
}

/**
 * Delete an item from DynamoDB
 */
export async function deleteItem(PK: string, SK: string): Promise<void> {
  await dynamoDb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK },
    })
  );
}

/**
 * Query items from DynamoDB
 */
export async function queryItems(
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>,
  indexName?: string,
  limit?: number
): Promise<DynamoDBItem[]> {
  const params: any = {
    TableName: TABLE_NAME,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues,
  };

  if (indexName) {
    params.IndexName = indexName;
  }

  if (limit) {
    params.Limit = limit;
  }

  const result = await dynamoDb.send(new QueryCommand(params));
  return (result.Items as DynamoDBItem[]) || [];
}

/**
 * Batch get items from DynamoDB
 */
export async function batchGetItems(
  keys: Array<{ PK: string; SK: string }>
): Promise<DynamoDBItem[]> {
  const result = await dynamoDb.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: keys,
        },
      },
    })
  );

  return (result.Responses?.[TABLE_NAME] as DynamoDBItem[]) || [];
}

/**
 * Batch write items to DynamoDB
 */
export async function batchWriteItems(items: DynamoDBItem[]): Promise<void> {
  const putRequests = items.map(item => ({
    PutRequest: {
      Item: item,
    },
  }));

  await dynamoDb.send(
    new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: putRequests,
      },
    })
  );
}
