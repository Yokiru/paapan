import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yetcdnutzvavuzfkbnar.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldGNkbnV0enZhdnV6ZmtibmFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5NjMyNywiZXhwIjoyMDgzODcyMzI3fQ.L0X69NwCWxAlJEywW_A6iOLaf3FsWJZRF4TDtaQkPyU'
);

async function testValues() {
  const { data: profiles, error: fetchErr } = await supabase.from('profiles').select('id, ai_response_style').limit(1);
  if (fetchErr || !profiles || profiles.length === 0) return;
  const userId = profiles[0].id;

  const stylesToTest = [
    'concise', 'balanced', 'detailed', 'creative', 'precise', 'normal'
  ];

  for (const style of stylesToTest) {
    const { error } = await supabase.from('profiles').update({ ai_response_style: style }).eq('id', userId);
    if (!error) console.log(`✅ "${style}" succeeded!`);
    else console.log(`❌ "${style}" failed`);
  }
}
testValues();
