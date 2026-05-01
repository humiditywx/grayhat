Sounds removal                                     x   
    - Delete frontend/src/hooks/useSounds.js entirely                                  
    - Remove useSounds imports and all play(...) calls from Sidebar.jsx,                 
    AddFriendDialog.jsx, SocketContext.jsx, StoryBar.jsx                                
    - Delete app/static/sounds/ directory and its files                                   
                                                                                         
    Eliminating redundant server requests                                                
    - StoryBar.jsx calls getStories() after every upload even though the story:new socket
    event already pushes the new story via ADD_STORY — remove that getStories() call and
    trust the socket                                                                      
    - getStories is also called in bootstrap already, so no need to re-fetch after upload
    at all                                                                                
    - The friend:request:accepted socket handler in SocketContext.jsx already updates     
    state, so InboxPanel doesn't need to do anything extra after accept beyond what it
    already dispatches — worth auditing for double-fetches                                
                                                                                       
    Backend                                                                               
    - db.create_all() now runs on every startup inside _run_column_migrations — should    
    gate it with a table existence check so it only runs when something is actually
    missing, avoiding a full metadata scan on every boot                                  
    - serialize_story triggers a COUNT query per story when called in loops (bootstrap,
    list_stories) — batch the view counts in a single GROUP BY query instead              
    - _run_column_migrations inspects the users table twice (once for early return, once
    for columns) — can be merged into one inspector call                                  
    - bootstrap() loads ALL messages for ALL conversations via selectinload(messages) just
    to generate a one-line preview — with real usage this pulls tens of thousands of rows;
    fix with a single batched last-message query (one extra query, N rows max)
    - Missing DB index on conversation_participants.conversation_id — the most-joined
    column in the app has no index, every conversation query hits a full scan here
    - Missing DB index on story_views.viewer_id
                                                   
    Dead code                                                                           
    - GroupsPanel.jsx is no longer rendered anywhere since the sidebar redesign — can be
    deleted                                                                               
    - InboxIcon and GroupsIcon SVG functions were in the old Sidebar and are now gone, but
     worth confirming no orphaned references remain
    - ScanCamera function in AddFriendDialog.jsx (lines 90-152) is defined but never
    rendered — tabs are 'qr'/'uuid'/'image' which map to MyQR/AddByUUID/ScanImage only

    Frontend perf
    - Sidebar.jsx sorts conversations with .slice().sort() on every render — wrap in
    useMemo([state.conversations]) to avoid resorting on unrelated state changes
