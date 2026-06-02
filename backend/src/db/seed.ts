import { db, initDb } from './index';

initDb();

const agentCount = (db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number }).count;

if (agentCount > 0) {
  console.log('Database already seeded. Skipping.');
  process.exit(0);
}

// Seed agents
const insertAgent = db.prepare('INSERT INTO agents (name, email, team) VALUES (?, ?, ?)');
insertAgent.run('Alice Chen', 'alice@supportiq.com', 'billing-ops');
insertAgent.run('Bob Kumar', 'bob@supportiq.com', 'engineering');
insertAgent.run('Carol Mendez', 'carol@supportiq.com', 'management');

const agents = db.prepare('SELECT * FROM agents').all() as Array<{ id: number }>;
const [alice, bob, carol] = agents;

// Seed tickets
const insertTicket = db.prepare(`
  INSERT INTO tickets (customer_name, customer_email, subject, body, status, priority, category, sentiment, triage_summary, assigned_agent_id, escalated_to, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().replace('T', ' ').slice(0, 19);

insertTicket.run('James Mitchell', 'james@acmecorp.com', 'Overcharged on last invoice', 'Hi, I noticed my invoice for last month was $120 but my plan is only $80/month. Please check and issue a refund for the difference.', 'in-progress', 'high', 'billing', 'negative', 'Customer was overcharged by $40 on their monthly invoice and is requesting a refund.', alice.id, null, daysAgo(3), daysAgo(2));

insertTicket.run('Sarah Patel', 'sarah@techstart.io', 'API returning 500 errors on all endpoints', 'Since your deployment this morning, every API call we make returns a 500 Internal Server Error. Our production system is completely down and we are losing revenue every minute. This is critical!', 'escalated', 'critical', 'technical', 'angry', 'Production API is returning 500 errors after a recent deployment, causing complete service outage.', bob.id, 'engineering', daysAgo(1), daysAgo(0));

insertTicket.run('David Wong', 'david.wong@email.com', 'Cannot login to my account', 'I have been trying to login for the past 2 hours. I reset my password but the reset email never arrives. I have checked spam. Please help urgently.', 'open', 'high', 'account', 'negative', 'Customer unable to login and password reset emails are not being delivered.', alice.id, null, daysAgo(1), daysAgo(1));

insertTicket.run('Emily Carter', 'emily.carter@businesspro.com', 'How do I upgrade to the Pro plan?', 'Hello! I am really enjoying the product. I would like to upgrade from Starter to Pro. Can you walk me through the process and let me know if there are any discounts for annual billing?', 'resolved', 'low', 'billing', 'positive', 'Customer wants to upgrade their plan and is asking about annual billing discounts.', alice.id, null, daysAgo(5), daysAgo(4));

insertTicket.run('Marcus Johnson', 'marcus@devagency.net', 'Feature request: dark mode for dashboard', 'Would love to see a dark mode option for the dashboard. I work late nights and the bright interface is straining. Would be a great quality-of-life improvement!', 'open', 'low', 'general', 'neutral', 'Customer requesting dark mode feature for better usability during night work.', carol.id, null, daysAgo(7), daysAgo(7));

insertTicket.run('Lisa Nguyen', 'lisa.nguyen@retail.com', 'Webhook not firing for order events', 'Our webhook endpoint is not receiving any events for new orders. We set it up exactly as documented. Checked the logs and there are no incoming requests from your service.', 'in-progress', 'high', 'technical', 'negative', 'Webhook integration is not triggering for order events despite correct configuration.', bob.id, null, daysAgo(2), daysAgo(1));

insertTicket.run('Tom Bradley', 'tom.b@freelance.com', 'Need to update billing email address', 'My company email has changed and I need to update the billing email on my account. The old email is no longer monitored and I am missing invoices.', 'resolved', 'medium', 'billing', 'neutral', 'Customer needs to update their billing email address due to company email change.', alice.id, null, daysAgo(10), daysAgo(8));

insertTicket.run('Priya Sharma', 'priya@healthtech.io', 'HIPAA compliance documentation needed', 'We are in the process of a security audit and need your HIPAA compliance documentation and BAA agreement. This is blocking our certification timeline.', 'open', 'critical', 'account', 'neutral', 'Customer requires HIPAA compliance documentation and BAA agreement for security audit.', carol.id, null, daysAgo(0), daysAgo(0));

insertTicket.run('Kevin O\'Brien', 'kevin@startupx.com', 'Integration with Slack not working after update', 'After your platform update yesterday, our Slack integration stopped posting notifications. The integration is still showing as connected in settings but no messages come through.', 'open', 'medium', 'technical', 'negative', 'Slack integration stopped sending notifications after a recent platform update.', bob.id, null, daysAgo(1), daysAgo(1));

insertTicket.run('Anna Kowalski', 'anna.k@enterprise.com', 'Team member cannot access shared workspace', 'I invited a colleague to our workspace last week. They received the invitation email and clicked the link, but get an "Access Denied" error when trying to join.', 'in-progress', 'medium', 'account', 'neutral', 'Team member cannot join workspace despite accepting invitation, receiving access denied error.', alice.id, null, daysAgo(4), daysAgo(3));

insertTicket.run('Ryan Foster', 'ryan.foster@marketing.com', 'How to export data to CSV?', 'Is there a way to export all our ticket data to CSV? I need to run some analysis in Excel for our quarterly report. I cannot find this option in the settings.', 'resolved', 'low', 'general', 'neutral', 'Customer looking for a CSV export feature for their data.', carol.id, null, daysAgo(6), daysAgo(5));

insertTicket.run('Stephanie Lee', 'steph@ecommerce.store', 'Payment processing failing at checkout', 'Our customers are reporting that payments are failing at checkout. We have tested with multiple cards and all fail with "Payment declined". This is causing us to lose sales.', 'escalated', 'critical', 'billing', 'angry', 'Payment processing completely broken at checkout, causing significant revenue loss for customer.', alice.id, 'billing-ops', daysAgo(0), daysAgo(0));

insertTicket.run('Chris Hoffman', 'chris.h@solodev.com', 'Documentation is outdated for v3 API', 'The documentation on your website still shows v2 API endpoints. I spent 3 hours debugging before realizing the docs were wrong. Please update them. The new v3 endpoints are completely different.', 'open', 'low', 'technical', 'negative', 'Customer frustrated by outdated API documentation that caused debugging confusion.', bob.id, null, daysAgo(3), daysAgo(3));

insertTicket.run('Maria Santos', 'maria@consultancy.biz', 'Account suspension without notice', 'My account has been suspended and I cannot access any data. I have an active subscription and there are no overdue payments. I need access restored immediately as I have client deliverables due today.', 'escalated', 'critical', 'account', 'angry', 'Active paying customer account suspended without notice, blocking access to critical business data.', carol.id, 'management', daysAgo(0), daysAgo(0));

insertTicket.run('Jordan Mills', 'jordan@nonprofit.org', 'Request for nonprofit discount', 'We are a registered 501(c)3 nonprofit. I saw on your website that you offer discounts for nonprofits. I would like to apply for this discount on our current Pro plan subscription.', 'open', 'low', 'billing', 'positive', 'Nonprofit organization inquiring about and requesting the advertised nonprofit discount.', alice.id, null, daysAgo(2), daysAgo(2));

// Get tickets for replies
const tickets = db.prepare('SELECT id FROM tickets').all() as Array<{ id: number }>;

const insertReply = db.prepare(`
  INSERT INTO replies (ticket_id, author_type, body, is_ai_draft, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

insertReply.run(tickets[0].id, 'agent', 'Hi James, thank you for reaching out. I have reviewed your account and confirmed the overcharge. I will process a $40 refund to your original payment method within 3-5 business days. I apologize for the inconvenience.', 0, daysAgo(2));

insertReply.run(tickets[1].id, 'ai_draft', 'Dear Sarah, I sincerely apologize for the critical service disruption you are experiencing. I have escalated this to our engineering team as our highest priority incident. Our team is actively investigating the 500 errors introduced in this morning\'s deployment. I will provide updates every 30 minutes until this is resolved.', 1, daysAgo(0));

insertReply.run(tickets[2].id, 'agent', 'Hi David, I apologize for the trouble logging in. I have checked your account and can see the password reset emails have been sending to your spam folder due to a filtering issue. I have manually reset your password to TempPass123! — please log in and change it immediately. Let me know if you need any further help.', 0, daysAgo(1));

insertReply.run(tickets[3].id, 'agent', 'Hi Emily! Great to hear you are enjoying SupportIQ. Upgrading to Pro is simple: go to Settings → Billing → Change Plan. Annual billing gives you 2 months free (17% discount). I have also applied a 10% loyalty discount to your account. You will see it on checkout. Let us know if you have any questions!', 0, daysAgo(4));

insertReply.run(tickets[5].id, 'agent', 'Hello Lisa, I am looking into your webhook configuration now. Could you please share the webhook endpoint URL so I can test it from our end? Also, please check that the webhook secret key has not changed in your settings — we rotated keys last week and this may have caused the disconnect.', 0, daysAgo(1));

console.log('Seeding complete!');
console.log(`- 3 agents created`);
console.log(`- 15 tickets created`);
console.log(`- 5 replies created`);
