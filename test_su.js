const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://yetcdnutzvavuzfkbnar.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldGNkbnV0enZhdnV6ZmtibmFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5NjMyNywiZXhwIjoyMDgzODcyMzI3fQ.L0X69NwCWxAlJEywW_A6iOLaf3FsWJZRF4TDtaQkPyU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('workspaces').select('*').limit(3);
  console.log(JSON.stringify({data, error}, null, 2));
}
check();
