export type ReactionType = 'like' | 'insightful' | 'disagree'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  updated_at: string
}

export interface UserRole {
  user_id: string
  role: 'admin' | 'moderator'
  created_at: string
}

export interface DebateTheme {
  id: string
  name: string
  slug: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  created_by: string | null
}

export interface Debate {
  id: string
  theme_id: string
  title: string
  description: string | null
  status: 'open' | 'closed' | 'archived'
  starts_at: string
  ends_at: string | null
  created_at: string
  created_by: string | null
  is_featured: boolean
}

export interface Message {
  id: string
  debate_id: string
  user_id: string
  content: string
  parent_id: string | null
  is_hidden: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Reaction {
  id: string
  message_id: string
  user_id: string
  type: ReactionType
  created_at: string
}

export interface ReactionCount {
  message_id: string
  type: ReactionType
  count: number
}

export type MessageWithReactions = Message & {
  reactionCounts: Record<ReactionType, number>
  userReactions: ReactionType[]
}
