#!/usr/bin/env node
// ============================================================
// Seed a DEMO workspace with a test login and fake sample data.
//
// Why: Razorpay's reviewer signs in to the app and clicks around. They
// need a login that works and a workspace that is not empty — and it
// must NOT be a real customer's workspace. This makes a separate one:
// its own account, owned by its own demo user. Row level security keeps
// it apart from every other workspace.
//
// What it makes (all fake, none of it real people):
//   - one demo user (the Owner of the demo workspace)
//   - 4 tags, 8 contacts, 6 conversations with messages
//   - 1 sales pipeline with 4 stages and 6 deals
// It makes NO WhatsApp connection, so nothing can message a real number.
//
// Usage (run from the repo root, it reads .env.local):
//   node scripts/seed-demo-workspace.mjs
//   node scripts/seed-demo-workspace.mjs --email review@example.com --password '...'
//
// Safe to run twice: an existing demo user is reused (its password is
// NOT changed unless you pass --password), and data is added only when
// the demo workspace has no contacts yet.
// ============================================================

import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

function readEnvFile(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

const env = { ...readEnvFile(resolve(process.cwd(), '.env.local')), ...process.env }
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const EMAIL = arg('email') ?? 'razorpay.review@example.com'
const GIVEN_PASSWORD = arg('password')
const FULL_NAME = 'Demo Reviewer'
const WORKSPACE_NAME = 'Demo Workspace'

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

function die(message, error) {
  console.error(message, error ? `\n${error.message ?? error}` : '')
  process.exit(1)
}

function makePassword() {
  // 16 characters, letters and digits only so it is easy to type.
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(16)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) die('Could not list users.', error)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

function daysAgo(days, hour = 10, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// ------------------------------------------------------------
// 1. The user (and, through the signup trigger, the workspace)
// ------------------------------------------------------------
let user = await findUserByEmail(EMAIL)
let password = GIVEN_PASSWORD
let created = false

if (!user) {
  password = password ?? makePassword()
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  })
  if (error) die('Could not create the demo user.', error)
  user = data.user
  created = true
} else if (GIVEN_PASSWORD) {
  const { error } = await db.auth.admin.updateUserById(user.id, { password: GIVEN_PASSWORD })
  if (error) die('Could not set the password.', error)
}

// The signup trigger makes the account and profile. Give it a moment.
let profile = null
for (let attempt = 0; attempt < 10 && !profile; attempt += 1) {
  const { data } = await db
    .from('profiles')
    .select('account_id, account_role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (data?.account_id) profile = data
  else await new Promise((r) => setTimeout(r, 400))
}
if (!profile) die('The demo user has no workspace. The signup trigger may have failed.')
if (profile.account_role !== 'owner') die(`The demo user is a ${profile.account_role}, expected owner.`)

const accountId = profile.account_id
const userId = user.id

const { error: renameError } = await db
  .from('accounts')
  .update({ name: WORKSPACE_NAME, default_currency: 'INR' })
  .eq('id', accountId)
if (renameError) die('Could not name the demo workspace.', renameError)

// ------------------------------------------------------------
// 2. Sample data, only if the workspace is still empty
// ------------------------------------------------------------
const { count: existing } = await db
  .from('contacts')
  .select('id', { count: 'exact', head: true })
  .eq('account_id', accountId)

let seeded = false
if (!existing) {
  const base = { account_id: accountId, user_id: userId }

  const tagRows = [
    { name: 'VIP', color: '#16a34a' },
    { name: 'New lead', color: '#3b82f6' },
    { name: 'Repeat buyer', color: '#d2aa3c' },
    { name: 'Follow up', color: '#f97316' },
  ].map((t) => ({ ...base, ...t }))
  const { data: tags, error: tagError } = await db.from('tags').insert(tagRows).select('id, name')
  if (tagError) die('Could not add tags.', tagError)
  const tag = Object.fromEntries(tags.map((t) => [t.name, t.id]))

  const people = [
    ['Anita Rao', 'Rao Home Decor', 'VIP'],
    ['Rahul Mehta', 'Mehta Traders', 'New lead'],
    ['Sara Khan', null, 'Repeat buyer'],
    ['Vikram Singh', 'Singh Interiors', 'Follow up'],
    ['Neha Joshi', null, 'New lead'],
    ['Imran Ali', 'Ali Gifts', 'Repeat buyer'],
    ['Kavya Nair', null, 'VIP'],
    ['Arjun Verma', 'Verma Prints', 'New lead'],
  ]
  const contactRows = people.map(([name, company], i) => ({
    ...base,
    name,
    company,
    phone: `+9190000000${String(i + 1).padStart(2, '0')}`,
    email: `${name.toLowerCase().replace(/ /g, '.')}@example.com`,
  }))
  const { data: contacts, error: contactError } = await db
    .from('contacts')
    .insert(contactRows)
    .select('id, name')
  if (contactError) die('Could not add contacts.', contactError)
  const contactId = Object.fromEntries(contacts.map((c) => [c.name, c.id]))

  const links = people.map(([name, , tagName]) => ({ contact_id: contactId[name], tag_id: tag[tagName] }))
  const { error: linkError } = await db.from('contact_tags').insert(links)
  if (linkError) die('Could not tag contacts.', linkError)

  // Conversations: [contact, status, unread, lines]. Each line is
  // [who, text, days ago, hour]. who: c = customer, a = agent.
  const chats = [
    ['Anita Rao', 'open', 2, [
      ['c', 'Hi, do you have the steel water bottle in blue?', 1, 10],
      ['a', 'Hello Anita! Yes, the blue one is in stock. It is Rs 499.', 1, 10],
      ['c', 'Great. Can you send a payment link?', 0, 9],
      ['c', 'Also, how long does delivery take?', 0, 9],
    ]],
    ['Rahul Mehta', 'pending', 1, [
      ['c', 'Hello, I want a quote for 50 notebooks with our logo.', 2, 15],
      ['a', 'Sure Rahul. Please share the logo and the size you prefer.', 2, 15],
      ['c', 'Sending the logo now.', 1, 11],
    ]],
    ['Sara Khan', 'open', 0, [
      ['c', 'Thank you, I received my order today.', 1, 17],
      ['a', 'Wonderful to hear, Sara! Please tell us if you need anything else.', 1, 17],
    ]],
    ['Vikram Singh', 'open', 1, [
      ['c', 'Where is my order?', 0, 8],
    ]],
    ['Neha Joshi', 'closed', 0, [
      ['c', 'Do you deliver to Pune?', 4, 12],
      ['a', 'Yes, we deliver across India. Delivery takes 3 to 5 days.', 4, 12],
      ['c', 'Perfect, thanks!', 4, 13],
    ]],
    ['Imran Ali', 'open', 0, [
      ['c', 'Can I get 20 gift boxes by Friday?', 3, 16],
      ['a', 'Let me check stock and confirm today.', 3, 16],
      ['a', 'Yes, we can deliver by Friday. Shall I send the invoice?', 3, 18],
    ]],
  ]

  for (const [name, status, unread, lines] of chats) {
    const last = lines[lines.length - 1]
    const lastAt = daysAgo(last[2], last[3])
    const { data: conv, error: convError } = await db
      .from('conversations')
      .insert({
        ...base,
        contact_id: contactId[name],
        status,
        unread_count: unread,
        last_message_text: last[1],
        last_message_at: lastAt,
        created_at: daysAgo(lines[0][2], lines[0][3]),
      })
      .select('id')
      .single()
    if (convError) die(`Could not add the conversation with ${name}.`, convError)

    const messageRows = lines.map(([who, text, d, h]) => ({
      conversation_id: conv.id,
      sender_type: who === 'c' ? 'customer' : 'agent',
      sender_id: who === 'c' ? null : userId,
      content_type: 'text',
      content_text: text,
      status: who === 'c' ? 'delivered' : 'read',
      created_at: daysAgo(d, h),
    }))
    const { error: msgError } = await db.from('messages').insert(messageRows)
    if (msgError) die(`Could not add messages for ${name}.`, msgError)
  }

  const { data: pipeline, error: pipeError } = await db
    .from('pipelines')
    .insert({ ...base, name: 'Sales Pipeline' })
    .select('id')
    .single()
  if (pipeError) die('Could not add the pipeline.', pipeError)

  const stageDefs = [
    ['New enquiry', '#3b82f6'],
    ['Quote sent', '#f59e0b'],
    ['Negotiation', '#8b5cf6'],
    ['Won', '#16a34a'],
  ]
  const { data: stages, error: stageError } = await db
    .from('pipeline_stages')
    .insert(stageDefs.map(([name, color], position) => ({ pipeline_id: pipeline.id, name, color, position })))
    .select('id, name')
  if (stageError) die('Could not add pipeline stages.', stageError)
  const stage = Object.fromEntries(stages.map((s) => [s.name, s.id]))

  const deals = [
    ['Rao Home Decor: bottles', 'Anita Rao', 'Quote sent', 2495],
    ['Mehta Traders: logo notebooks', 'Rahul Mehta', 'New enquiry', 18000],
    ['Singh Interiors: wall prints', 'Vikram Singh', 'Negotiation', 42500],
    ['Ali Gifts: 20 gift boxes', 'Imran Ali', 'Quote sent', 9800],
    ['Verma Prints: bulk order', 'Arjun Verma', 'New enquiry', 27000],
    ['Kavya Nair: office set', 'Kavya Nair', 'Won', 6400],
  ]
  const { error: dealError } = await db.from('deals').insert(
    deals.map(([title, who, stageName, value]) => ({
      ...base,
      pipeline_id: pipeline.id,
      stage_id: stage[stageName],
      contact_id: contactId[who],
      title,
      value,
      currency: 'INR',
      status: stageName === 'Won' ? 'won' : 'open',
    })),
  )
  if (dealError) die('Could not add deals.', dealError)

  seeded = true
}

// ------------------------------------------------------------
// 3. Report
// ------------------------------------------------------------
console.log('')
console.log('Demo workspace is ready.')
console.log(`  Workspace : ${WORKSPACE_NAME} (${accountId})`)
console.log(`  Login     : ${EMAIL}`)
if (created || GIVEN_PASSWORD) {
  console.log(`  Password  : ${password}`)
  console.log('  (shown once; change it after Razorpay approves the account)')
} else {
  console.log('  Password  : unchanged (the user already existed)')
}
console.log(`  Sample data: ${seeded ? 'added' : 'already there, left as it was'}`)
console.log('  WhatsApp  : not connected on purpose')
