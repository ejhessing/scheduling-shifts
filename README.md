# Time Tracking & Scheduling Application

A next-generation time tracking and scheduling platform built on AWS serverless architecture. This application combines the best features from leading time tracking solutions while addressing their common pain points with reliability-first design, transparent pricing, and mobile-first experience.

## 🌟 Key Features

- **Sub-second precision time tracking** with GPS geofencing
- **AI-powered auto-scheduling** based on patterns and rules
- **Real-time messaging** via WebSocket
- **Advanced reporting & analytics**
- **Compliance & labor law engine** (FLSA, GDPR, HIPAA)
- **Built-in payroll calculations** with integration support
- **Mobile-first design** with full feature parity
- **Transparent per-user pricing**

## 📦 Project Structure

```
time-tracking-app/
├── packages/
│   ├── backend/          # Lambda functions (Node.js)
│   ├── web/              # React web app (Vite + TypeScript)
│   ├── mobile/           # React Native apps (iOS/Android) - Coming soon
│   ├── shared/           # Shared types, utilities, and constants
│   └── infrastructure/   # AWS CDK infrastructure as code
├── docs/                 # Documentation
└── package.json          # Root workspace configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd time-tracking-app

# Install dependencies
npm install

# Build shared packages
npm run build -w @time-tracking/shared
```

### Development

```bash
# Start the web development server
npm run dev:web

# Watch backend changes
npm run dev:backend

# Deploy infrastructure (first time)
cd packages/infrastructure
cdk bootstrap
cdk deploy
```

## 📚 Documentation

- **[Architecture](./docs/ARCHITECTURE.md)** - System design and AWS architecture
- **[Setup Guide](./docs/SETUP.md)** - Detailed development environment setup
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Database Schema](./docs/DATABASE.md)** - DynamoDB table design and access patterns
- **[API Reference](./docs/API.md)** - REST API endpoints and specifications

## 🏗️ Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **React Router** - Client-side routing
- **Tanstack Query** - Data fetching and caching
- **Zustand** - State management

### Backend
- **AWS Lambda** - Serverless compute
- **API Gateway** - REST API
- **DynamoDB** - NoSQL database
- **S3** - File storage
- **Cognito** - Authentication
- **EventBridge** - Scheduled jobs
- **CloudWatch** - Monitoring and logs

### Infrastructure
- **AWS CDK** - Infrastructure as code
- **TypeScript** - CDK language

## 🎯 MVP Features (Phase 1)

- ✅ User authentication (signup, login, token refresh)
- ✅ Time tracking (clock in/out with GPS)
- ✅ Basic scheduling (create, edit, delete shifts)
- ✅ User management
- ✅ Mobile-responsive web app
- ✅ Basic reporting
- ✅ DynamoDB single-table design
- ✅ Geofencing validation

## 🔮 Roadmap

### Phase 2: Enhanced Features (Q2 2024)
- Shift swapping with approval workflow
- Break management and compliance
- Advanced reporting and analytics
- Document management
- Push notifications
- Real-time messaging

### Phase 3: Advanced Capabilities (Q3 2024)
- AI-powered auto-scheduling
- Payroll integrations (QuickBooks, Gusto, ADP)
- Mobile apps (React Native)
- Kiosk mode
- Advanced analytics dashboard

### Phase 4: Enterprise Features (Q4 2024)
- White-labeling
- Custom integrations
- Multi-language support
- Advanced compliance rules
- Audit logging

## 💰 Pricing

### Free Tier (Up to 10 users)
- Time tracking & timesheets
- Basic scheduling
- Mobile apps
- GPS tracking
- Basic reporting

### Starter Plan: $2.99/user/month
- Everything in Free
- Advanced scheduling
- Shift swapping
- Break compliance
- Email support

### Professional Plan: $5.99/user/month
- Everything in Starter
- Auto-scheduling AI
- Payroll integration
- Advanced reporting
- API access
- Priority support

### Enterprise Plan: Custom Pricing
- Everything in Professional
- Custom integrations
- Dedicated support
- SLA guarantees
- White-labeling

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔒 Security

- SOC 2 Type II certification (planned)
- GDPR compliant
- HIPAA compliant (for healthcare)
- Data encryption at rest (AES-256)
- Data encryption in transit (TLS 1.3)
- Regular security audits

## 📞 Support

- Documentation: [docs/](./docs/)
- Email: support@timetracking.example.com
- Issues: [GitHub Issues](https://github.com/yourorg/time-tracking-app/issues)

## 🎉 Acknowledgments

Built with inspiration from leading time tracking solutions while addressing their pain points:
- Deputy: Strong scheduling, but buggy calculations
- Connecteam: Great mobile-first, but limited integrations
- Homebase: Free plan, but minute-only precision
- When I Work: Good for larger teams, but expensive

Our goal: Combine the best features while delivering reliability-first, transparent pricing, and excellent support.

---

**Made with ❤️ for teams who deserve better time tracking**
