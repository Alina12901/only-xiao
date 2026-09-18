import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

const encryptionKeyValue = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim() ?? ''

function getEncryptionKey() {
  const key = Buffer.from(encryptionKeyValue, 'base64')

  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 32-byte base64 key')
  }

  return key
}

export function isCredentialEncryptionConfigured() {
  try {
    getEncryptionKey()
    return true
  } catch (_error) {
    return false
  }
}

export function encryptSecret(value) {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])

  return {
    encryptedKey: encrypted.toString('base64'),
    keyIv: iv.toString('base64'),
    keyTag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptSecret(record) {
  const key = getEncryptionKey()
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(record.key_iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(record.key_tag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(record.encrypted_key, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export async function getProviderCredential(client, ownerId, provider) {
  const { data, error } = await client
    .from('provider_credentials')
    .select(
      'provider, provider_type, label, base_url, adapter, encrypted_key, key_iv, key_tag, updated_at',
    )
    .eq('owner_id', ownerId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) {
    return { error }
  }

  if (!data) {
    return { credential: null, record: null }
  }

  try {
    return {
      credential: decryptSecret(data),
      record: data,
    }
  } catch (_error) {
    return { error: new Error('凭据解密失败') }
  }
}

export async function saveProviderCredential(
  client,
  ownerId,
  provider,
  apiKey,
  metadata = {},
) {
  const encrypted = encryptSecret(apiKey)
  const { error } = await client.from('provider_credentials').upsert(
    {
      owner_id: ownerId,
      provider,
      provider_type: metadata.providerType || 'official',
      label: metadata.label || null,
      base_url: metadata.baseUrl || null,
      adapter: metadata.adapter || null,
      encrypted_key: encrypted.encryptedKey,
      key_iv: encrypted.keyIv,
      key_tag: encrypted.keyTag,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'owner_id,provider',
    },
  )

  return { error }
}

export async function deleteProviderCredential(client, ownerId, provider) {
  const { error } = await client
    .from('provider_credentials')
    .delete()
    .eq('owner_id', ownerId)
    .eq('provider', provider)

  return { error }
}

export async function listStoredProviderRecords(client, ownerId) {
  const { data, error } = await client
    .from('provider_credentials')
    .select('provider, provider_type, label, base_url, adapter, updated_at')
    .eq('owner_id', ownerId)

  if (error) {
    return { error }
  }

  return {
    records: data ?? [],
  }
}
