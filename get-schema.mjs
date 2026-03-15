const url = "https://yetcdnutzvavuzfkbnar.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldGNkbnV0enZhdnV6ZmtibmFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5NjMyNywiZXhwIjoyMDgzODcyMzI3fQ.L0X69NwCWxAlJEywW_A6iOLaf3FsWJZRF4TDtaQkPyU";
fetch(url)
  .then(res => res.json())
  .then(data => {
    const profileDef = data.definitions.profiles;
    console.log("Profiles Definition:", JSON.stringify(profileDef, null, 2));
  })
  .catch(console.error);
