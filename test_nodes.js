const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://yetcdnutzvavuzfkbnar.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldGNkbnV0enZhdnV6ZmtibmFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5NjMyNywiZXhwIjoyMDgzODcyMzI3fQ.L0X69NwCWxAlJEywW_A6iOLaf3FsWJZRF4TDtaQkPyU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('workspaces').select('nodes').limit(1);
  if (data && data.length > 0) {
      const nodes = data[0].nodes;
      console.log(`Node count: ${nodes.length}`);
      if (nodes.length > 0) {
          console.log(JSON.stringify(nodes[0], null, 2));
          console.log(JSON.stringify(nodes[nodes.length - 1], null, 2));
      }
      
      // Let's check for malformed nodes
      const badNodes = nodes.filter(n => !n.id || !n.position || typeof n.position.x !== 'number' || typeof n.position.y !== 'number');
      console.log(`Bad nodes count: ${badNodes.length}`);
      if (badNodes.length > 0) {
          console.log("Sample bad node:", JSON.stringify(badNodes[0], null, 2));
      }
  }
}
check();
