import type { PageLoad } from './$types'
import { supabase } from '$lib/supabase'

export const load: PageLoad = async () => {
    try {
        const [
            {data: agents, error: agentsErr},
            {data: energy, error: energyErr},
            {data: goldChests, error: goldChestsErr},
            {data: trees, error: treesErr},
            {data: eggs, error: eggsErr},
            { data: messages, error: messagesErr },
            { data: logs, error: logsErr },
            { data: cursedAgents, error: cursedErr }
        ] = await Promise.all([
            supabase.from('agents').select('*'),
            supabase.from('energy_packets').select('*'),
            supabase.from('gold_chests').select('*'),
            supabase.from('trees').select('*'),
            supabase.from('eggs').select('*'),
            supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(10),
            supabase.from('event_queue').select('target_agent').eq('function_name', 'apply_curse').not('target_agent', 'is', null)
        ])

        if (agentsErr) {
            console.error('Error loading agents:', agentsErr)
        }
        if (energyErr) {
            console.error('Error loading energy packets:', energyErr)
        }
        if (goldChestsErr) {
            console.error('Error loading gold chests:', goldChestsErr)
        }
        if (treesErr) {
            console.error('Error loading trees:', treesErr)
        }
        if (eggsErr) {
            console.error('Error loading eggs:', eggsErr)
        }
        if (messagesErr) {
            console.error('Error loading messages:', messagesErr)
        }
        if (logsErr) {
            console.error('Error loading logs:', logsErr)
        }
        if (cursedErr) {
            console.error('Error loading cursed agents:', cursedErr)
        }

        return { 
            agents: agents || [], 
            energy: energy || [], 
            goldChests: goldChests || [],
            trees: trees || [],
            eggs: eggs || [],
            messages: messages || [], 
            logs: logs || [],
            cursedAgents: (cursedAgents || []).map(row => row.target_agent).filter(id => id !== null) as number[]
        }
    } catch (error) {
        console.error('Database connection failed:', error)
        return { 
            agents: [], 
            energy: [], 
            goldChests: [],
            trees: [],
            eggs: [],
            messages: [], 
            logs: [],
            cursedAgents: []
        }
    }
}