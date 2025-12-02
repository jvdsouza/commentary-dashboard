# Goal
This project repository aims to provide a means to have a dashboard for esports commentators.

# Requirements 
This dashboard is meant to provide information about the players, their achievements and their "stories" of their growth.
This information should be procured from the start.gg api, the documentation is found here: https://developer.start.gg/docs/intro/
It should take a start.gg tournament URL, for example, https://www.start.gg/tournament/manila-madness-4/details and the event's name to find within the tournament, or the tournament page directly, such as https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event for example, and gather player data of all those involved.
It should highlight major contenders, new contenders and those who are improving. 

In terms of gauging improvements, we can use the start.gg's api to find their placing in similar events involving the previous iterations of the tournaments, or tournaments in similar size. If possible, we can also use these two URLS:
https://api.fgctools.com/playersearch?query=bigcheeseburger
https://api.fgctools.com/player/4098493

If the API is not available due to issues with accessing the server, however the way to access the API is correctly done, do not worry. The primary data source will be the server but the error must be returned to a clear area for the user to see.

The first URL gets a player by their start.gg name tag, and gets a JSON blob that has their ID. the second URL then uses that ID to find their current elo, the change over time, along with tournaments they've attended as a competitor in.

The dashboard MUST be able to use an environment variable to ingest a start.gg authorization token.
The dashboard MUST be able to pull data in real time or be able to have data updated quickly. The information must be able to be updated on demand or within 30 second intervals.
The dashboard MUST react quickly to user input and action.
The dashboard MUST react quickly to updates in information.
The dashboard MUST be able to display information of the current running matches in the tournament bracket.
The dashboard MUST display the title of the bracket (ie https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event/brackets/1941086/2850777 should have the name Pool TKA1 displayed).
The dashboard MUST display the name of the round of the displayed matches currently occuring (ie https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event/set/95905651 should display the name Winners Round 4).
The dashboard MUST have the ability to show the bracket with a quick way to highlight the path a player has gone through in the bracket through a dropdown with search capability to choose the player name.
The dashboard MUST be able to give high level notes in dot points about the player's achievements previous to this tournament and including this tournament, and notes against their opponents they've fought.
The information MUST be EASILY ACCESSIBLE and EASY TO READ.
The dashboard SHOULD NOT layer UI elements such as nesting scroll bars or hard to read text.
The dashboard SHOULD have clear UI in the way it is promoting a good User Experience.
The dashboard MUST NOT leak secrets such as environment variables, user's real names or anything that can be used against the people using or being represented in it.

Right now this only needs to be a frontend application built in react and should be servable on a web page hosted by a server.