# AWS Infrastructure Stack & Cost Estimation

## Complete AWS Stack Overview

### **Core Services**

#### 1. **DynamoDB**
- **Table**: TimeTrackingApp (Single-table design)
- **Billing Mode**: On-Demand (Pay per request)
- **Features**:
  - 2 Global Secondary Indexes (GSI1, GSI2)
  - Point-in-time recovery enabled
  - DynamoDB Streams enabled
  - Data retention: RETAIN (survives stack deletion)

#### 2. **AWS Lambda**
- **Total Functions**: 34 Lambda functions
- **Runtime**: Node.js 20.x
- **Memory**: 512 MB (default), 1024 MB for reports
- **Timeout**: 30 seconds (default), 60 seconds for reports/notifications
- **Features**: X-Ray tracing enabled

**Function Breakdown:**
- Authentication: 3 functions (signup, login, refreshToken)
- Users: 3 functions (getProfile, updateProfile, listUsers)
- Locations: 4 functions (create, get, update, delete)
- Time Tracking: 5 functions (clockIn, clockOut, getTimesheet, updateEntry, approve)
- Scheduling: 5 functions (createShift, updateShift, deleteShift, getSchedule, swapShift)
- Advanced Scheduling: 5 functions (templates, availability, conflicts)
- Time-Off: 4 functions (request, review, getRequests, getBalance)
- Reports: 1 function (generateReport)
- Compliance: 1 function (checkCompliance)
- Notifications: 2 functions (sendNotification, scheduledNotifications)
- Total: 34 functions

#### 3. **API Gateway**
- **Type**: REST API
- **Stage**: prod
- **Features**:
  - CORS enabled
  - X-Ray tracing enabled
  - CloudWatch logs (INFO level)
  - Cognito authorizer
  - ~30 API endpoints

#### 4. **Amazon Cognito**
- **User Pool**: TimeTrackingUsers
- **Features**:
  - Email sign-in
  - Email verification
  - Password recovery
  - MFA: Optional
  - User pool client for web app

#### 5. **Amazon S3**
- **Bucket**: Documents & images storage
- **Features**:
  - Versioning enabled
  - S3-managed encryption
  - Lifecycle rules (delete old versions after 90 days)
  - Block all public access

#### 6. **Amazon SNS**
- **Topic**: TimeTrackingNotifications
- **Purpose**: Async notification delivery
- **Subscriptions**: 1 Lambda function

#### 7. **Amazon EventBridge**
- **Rules**: 1 scheduled rule (hourly)
- **Target**: scheduledNotifications Lambda

#### 8. **Amazon SES**
- **Purpose**: Email notifications
- **Templates**: 6 email types
- **Permissions**: Granted to notification Lambda

#### 9. **CloudWatch Logs**
- **Retention**: 7 days
- **Log Groups**: 34+ (one per Lambda function + API Gateway)

#### 10. **AWS X-Ray**
- **Enabled for**: Lambda functions, API Gateway
- **Purpose**: Distributed tracing

---

## Cost Estimation (Monthly)

### **Assumptions:**
- Small business with 50 employees
- 200 clock-ins/clock-outs per day (100 employees × 2)
- 500 API calls per day (schedule views, reports, etc.)
- 10 time-off requests per week
- 5 GB data storage in DynamoDB
- 10 GB file storage in S3
- 1,000 notification emails per month
- US-East-1 region pricing

---

### **Detailed Cost Breakdown**

#### **1. DynamoDB - On-Demand**
```
Write Requests:
- Clock-ins/outs: 200/day × 30 = 6,000/month
- Shifts, time-off, etc: ~4,000/month
- Total writes: ~10,000/month
- Cost: 10,000 × $1.25 per million = $0.01

Read Requests:
- API calls: 500/day × 30 = 15,000/month
- GSI queries: ~10,000/month
- Total reads: ~25,000/month
- Cost: 25,000 × $0.25 per million = $0.01

Storage:
- Estimated: 5 GB
- Cost: 5 × $0.25/GB = $1.25

Point-in-Time Recovery:
- Cost: 5 GB × $0.20/GB = $1.00

DynamoDB Streams:
- Minimal reads: ~$0.50

Total DynamoDB: ~$2.77/month
```

#### **2. AWS Lambda**
```
Invocations:
- 34 functions × average 100 invocations/day = 102,000/month
- First 1M requests free
- Cost: $0.00

Compute Duration (GB-seconds):
- Average: 512 MB, 200ms per invocation
- 102,000 × 0.5 GB × 0.2s = 10,200 GB-seconds
- First 400,000 GB-seconds free
- Cost: $0.00

Total Lambda: ~$0.00/month (within free tier)
```

#### **3. API Gateway**
```
API Calls:
- ~20,000 API calls/month
- First 1M requests: $3.50 per million
- Cost: 20,000 × $0.0000035 = $0.07

Data Transfer:
- Average 5 KB per response
- 20,000 × 5 KB = 100 MB
- First 1 GB free
- Cost: $0.00

Total API Gateway: ~$0.07/month
```

#### **4. Amazon Cognito**
```
Monthly Active Users (MAU): 50 employees
- First 50,000 MAUs free
- Cost: $0.00

Total Cognito: ~$0.00/month (free tier)
```

#### **5. Amazon S3**
```
Storage:
- Documents, photos: ~10 GB
- Cost: 10 × $0.023/GB = $0.23

Requests:
- PUT requests: ~1,000/month
- Cost: 1,000 × $0.005 per 1,000 = $0.01
- GET requests: ~5,000/month
- Cost: 5,000 × $0.0004 per 1,000 = $0.002

Data Transfer:
- Minimal (within AWS): $0.00

Total S3: ~$0.24/month
```

#### **6. Amazon SES**
```
Email Sending:
- 1,000 emails/month
- First 62,000/month free (if sending from EC2)
- Otherwise: $0.10 per 1,000 emails
- Cost: 1,000 × $0.0001 = $0.10

Total SES: ~$0.10/month
```

#### **7. Amazon SNS**
```
Notifications:
- 1,000 publishes/month
- First 1M free
- Cost: $0.00

Total SNS: ~$0.00/month
```

#### **8. Amazon EventBridge**
```
Custom Events:
- Scheduled rule: 720 invocations/month (hourly)
- First 1M events free
- Cost: $0.00

Total EventBridge: ~$0.00/month
```

#### **9. CloudWatch Logs**
```
Ingestion:
- ~5 GB/month from Lambda logs
- Cost: 5 × $0.50/GB = $2.50

Storage (7-day retention):
- ~1 GB average stored
- Cost: 1 × $0.03/GB = $0.03

Total CloudWatch: ~$2.53/month
```

#### **10. AWS X-Ray**
```
Traces:
- ~20,000 traces/month
- First 100,000 traces free
- Cost: $0.00

Total X-Ray: ~$0.00/month
```

---

## **TOTAL MONTHLY COST ESTIMATE**

### **Small Business (50 employees)**
```
DynamoDB:          $2.77
Lambda:            $0.00  (free tier)
API Gateway:       $0.07
Cognito:           $0.00  (free tier)
S3:                $0.24
SES:               $0.10
SNS:               $0.00  (free tier)
EventBridge:       $0.00  (free tier)
CloudWatch Logs:   $2.53
X-Ray:             $0.00  (free tier)
────────────────────────
TOTAL:            ~$5.71/month
```

### **Medium Business (200 employees)**
```
DynamoDB:          $8.50   (4× data, requests)
Lambda:            $2.00   (some overage)
API Gateway:       $0.28   (80,000 calls)
Cognito:           $0.00   (still free)
S3:                $1.15   (40 GB storage)
SES:               $0.40   (4,000 emails)
SNS:               $0.00   (free tier)
EventBridge:       $0.00   (free tier)
CloudWatch Logs:   $8.00   (more logs)
X-Ray:             $0.05   (trace storage)
────────────────────────
TOTAL:            ~$20.38/month
```

### **Large Business (1,000 employees)**
```
DynamoDB:          $45.00  (high read/write)
Lambda:            $15.00  (beyond free tier)
API Gateway:       $1.40   (400,000 calls)
Cognito:           $0.00   (still free)
S3:                $5.75   (200 GB storage)
SES:               $2.00   (20,000 emails)
SNS:               $0.05   (overage)
EventBridge:       $0.00   (free tier)
CloudWatch Logs:   $35.00  (high volume)
X-Ray:             $0.50   (trace storage)
────────────────────────
TOTAL:            ~$104.70/month
```

---

## **Cost Optimization Tips**

### **Immediate Savings:**
1. **CloudWatch Logs**: Reduce retention to 3 days → Save ~40%
2. **DynamoDB**: Use provisioned capacity if usage is predictable → Save 30-50%
3. **S3**: Add intelligent tiering → Save 20-30% on storage
4. **Lambda**: Optimize memory allocation → Save 10-20%

### **Long-term Optimizations:**
1. **Reserved Capacity**: DynamoDB reserved capacity (1-year) → Save ~50%
2. **Compute Savings Plans**: Lambda savings plan → Save ~20%
3. **S3 Lifecycle**: Move old files to Glacier → Save ~70% on archival
4. **API Caching**: Enable API Gateway caching → Reduce Lambda/DynamoDB calls

### **Monitoring:**
1. **AWS Cost Explorer**: Track daily costs
2. **AWS Budgets**: Set alerts at $10, $25, $50
3. **CloudWatch Alarms**: Alert on unusual Lambda invocations

---

## **Infrastructure Highlights**

✅ **Serverless Architecture** - No server management, auto-scaling
✅ **High Availability** - Multi-AZ by default
✅ **Pay-per-use** - Only pay for what you consume
✅ **Free Tier Eligible** - Many services free for 12 months
✅ **Secure** - Cognito auth, encrypted storage, private network
✅ **Scalable** - Handles 1-10,000 users without code changes
✅ **Cost-effective** - $5-100/month for most businesses
✅ **Production-ready** - Point-in-time recovery, monitoring, tracing

---

## **Comparison to Traditional Infrastructure**

### **Traditional (EC2 + RDS)**
```
EC2 t3.medium:           $30/month
RDS t3.micro:            $15/month
Load Balancer:           $16/month
────────────────────────
TOTAL:                  ~$61/month minimum
```

### **This Serverless Stack**
```
Small business:          $5.71/month
Medium business:        $20.38/month
Large business:        $104.70/month
```

**Savings**: 90% for small businesses, 66% for medium businesses

---

## **First Year (with AWS Free Tier)**

If this is a new AWS account, you get 12 months free tier:
- Lambda: 1M requests + 400,000 GB-seconds/month FREE
- DynamoDB: 25 GB storage + 25 WCU + 25 RCU FREE
- S3: 5 GB storage + 20,000 GET + 2,000 PUT FREE
- CloudWatch: 10 custom metrics + 5 GB logs FREE

**Estimated first year cost**: ~$1-3/month (CloudWatch overage only)

---

## **Summary**

Your AWS infrastructure is **extremely cost-effective** for a time-tracking application:

- **Small team (50 employees)**: ~$5.71/month (~$68/year)
- **Medium team (200 employees)**: ~$20.38/month (~$244/year)
- **Large team (1,000 employees)**: ~$104.70/month (~$1,256/year)

**Compare to competitors**:
- TSheets/QuickBooks Time: $8-10/user/month = $400-500/month for 50 users
- When I Work: $4/user/month = $200/month for 50 users
- Deputy: $4.50/user/month = $225/month for 50 users

**Your infrastructure cost is 95-98% less than SaaS pricing!** 🎉
