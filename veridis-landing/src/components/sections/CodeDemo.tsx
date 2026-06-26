"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CodeBlock } from "@/components/ui";

const languages = [
  { id: "javascript", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "curl", label: "cURL" },
];

const codeExamples: Record<string, string> = {
  javascript: `import Veridis from 'veridis';

const veridis = new Veridis({
  apiKey: process.env.VERIDIS_API_KEY
});

// Create an agent with spending controls
const agent = await veridis.agents.create({
  name: 'Shopping Assistant',
  spendingLimit: 1000,
  approvalRequired: amount > 100,
  allowedMerchants: ['amazon', 'bestbuy', 'target'],
  webhookUrl: 'https://your-app.com/webhooks/veridis'
});

// Execute a purchase
const transaction = await agent.purchase({
  merchantId: 'amazon',
  items: [{ sku: 'B08N5WRWNW', quantity: 1 }],
  shippingAddress: user.defaultAddress
});

console.log(\`Order placed: \${transaction.id}\`);`,

  python: `import veridis

client = veridis.Client(api_key=os.environ["VERIDIS_API_KEY"])

# Create an agent with spending controls
agent = client.agents.create(
    name="Shopping Assistant",
    spending_limit=1000,
    approval_required=lambda amount: amount > 100,
    allowed_merchants=["amazon", "bestbuy", "target"],
    webhook_url="https://your-app.com/webhooks/veridis"
)

# Execute a purchase
transaction = agent.purchase(
    merchant_id="amazon",
    items=[{"sku": "B08N5WRWNW", "quantity": 1}],
    shipping_address=user.default_address
)

print(f"Order placed: {transaction.id}")`,

  curl: `# Create an agent
curl https://api.veridis.ai/v1/agents \\
  -H "Authorization: Bearer $VERIDIS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Shopping Assistant",
    "spending_limit": 1000,
    "approval_required_threshold": 100,
    "allowed_merchants": ["amazon", "bestbuy", "target"]
  }'

# Execute a purchase
curl https://api.veridis.ai/v1/agents/agent_123/purchase \\
  -H "Authorization: Bearer $VERIDIS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant_id": "amazon",
    "items": [{"sku": "B08N5WRWNW", "quantity": 1}]
  }'`,
};

export function CodeDemo() {
  const [activeLanguage, setActiveLanguage] = useState("javascript");

  return (
    <section className="py-20 md:py-32 bg-[#0A2540]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column - Explanation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Start building in minutes,{" "}
              <span className="text-[#635BFF]">not months</span>
            </h2>
            <p className="mt-6 text-lg text-white/70">
              Veridis abstracts the complexity of agent commerce—merchant
              authentication, payment protocols, fraud prevention—into a simple
              API that any AI application can use.
            </p>

            <div className="mt-10 space-y-6">
              <FeatureItem
                number="01"
                title="Create an agent"
                description="Define spending limits, approval workflows, and merchant access in a single API call."
              />
              <FeatureItem
                number="02"
                title="Set guardrails"
                description="Configure transaction limits, category restrictions, and real-time approval hooks."
              />
              <FeatureItem
                number="03"
                title="Let agents transact"
                description="Your AI agent can now purchase, book, and subscribe on behalf of users."
              />
            </div>
          </motion.div>

          {/* Right Column - Code */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Language Tabs */}
            <div className="flex gap-2 mb-4">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setActiveLanguage(lang.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLanguage === lang.id
                      ? "bg-[#635BFF] text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <CodeBlock
              code={codeExamples[activeLanguage]}
              language={activeLanguage}
              showLineNumbers={true}
              variant="dark"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeatureItem({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#635BFF]/20 flex items-center justify-center">
        <span className="text-sm font-bold text-[#635BFF]">{number}</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-white/60">{description}</p>
      </div>
    </div>
  );
}
