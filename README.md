# Esports Commentary Dashboard

A comprehensive dashboard for esports commentators to track player data, tournament progress, and real-time match information. Built with React and TypeScript, integrating with start.gg and FGC Tools APIs.

## Features

- **Tournament Integration**: Load tournaments from start.gg URLs
- **Player Analytics**: Track player ELO, tournament history, and improvement trends
- **Real-time Updates**: Automatic data refresh every 30 seconds
- **Bracket Visualization**: Interactive tournament brackets with player path highlighting
- **Player Search**: Quick search and selection of tournament participants
- **Performance Categories**: Automatically categorizes players as major contenders, new contenders, or improving players
- **Match Information**: Real-time current matches with bracket and round details
- **Error Handling**: Clear error messages and fallback behavior for API issues

## Setup

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- start.gg API token (required)

### Installation

1. Clone or download the project
2. Navigate to the project directory:
   ```bash
   cd commentary-dashboard
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

5. Edit `.env` and add your start.gg API token:
   ```
   VITE_STARTGG_API_TOKEN=your_start_gg_api_token_here
   ```

### Getting a start.gg API Token

1. Go to [start.gg Developer Portal](https://developer.start.gg/docs/authentication)
2. Create an account and generate an API token
3. Add the token to your `.env` file

### Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage

1. **Load a Tournament**: 
   - Enter a start.gg tournament URL in the input field
   - Optionally specify an event name to focus on a specific event within the tournament
   - Click "Load Tournament"

2. **View Player Information**:
   - Browse categorized players in the sidebar (Major Contenders, New Contenders, Improving Players)
   - Use the search function to find specific players
   - Click on any player to see detailed information including achievements and tournament history

3. **Bracket Visualization**:
   - View current matches in progress
   - Select a player from the dropdown to highlight their path through the bracket
   - See bracket names and round information for all matches

4. **Real-time Updates**:
   - Enable auto-refresh to get updated data every 30 seconds
   - Manually refresh data using the refresh button

## URL Examples

The dashboard supports various start.gg URL formats:

- Tournament overview: `https://www.start.gg/tournament/manila-madness-4/details`
- Specific event: `https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event`
- Bracket view: `https://www.start.gg/tournament/manila-madness-4/event/tekken-8-twt-challenger-event/brackets/1941086/2850777`

## API Integration

### start.gg API
- Tournament data and brackets
- Player information and match results
- Real-time match status updates

### FGC Tools API
- Player ELO ratings and history
- Tournament performance tracking
- Improvement metrics calculation

Note: If FGC Tools API is unavailable, the dashboard will still function with start.gg data only.

## Technical Details

### Architecture
- **Frontend**: React with TypeScript
- **State Management**: React hooks and context
- **Styling**: CSS with responsive design
- **API Client**: Axios for HTTP requests
- **Real-time Updates**: Polling-based refresh system

### Security
- API tokens are handled securely through environment variables
- No sensitive user data is exposed in the UI
- Proper error handling prevents information leakage

### Performance
- Efficient data fetching with batched API requests
- Optimized re-rendering with React memoization
- Responsive design for various screen sizes

## Development

### Project Structure
```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── services/           # API service layers
├── types/              # TypeScript type definitions
└── App.tsx            # Main application component
```

### Building for Production
```bash
npm run build
```

### Linting and Type Checking
```bash
npm run lint
npm run typecheck
```

## Troubleshooting

### Common Issues

1. **API Token Error**: Make sure your start.gg API token is correctly set in the `.env` file
2. **CORS Issues**: The application is designed to work with the official APIs - ensure you're not using a development server that blocks cross-origin requests
3. **Loading Issues**: Check your internet connection and verify the tournament URL format
4. **No Player Data**: Some tournaments might have limited participant data available through the API

### Error Messages

The dashboard provides clear error messages for common issues:
- Invalid tournament URLs
- API connectivity problems
- Missing or expired API tokens
- Network connectivity issues

## Contributing

This project follows the requirements specified in the claude.md file. When making changes:
1. Ensure all MUST requirements are maintained
2. Follow the existing code style and patterns
3. Test thoroughly with real tournament data
4. Update documentation as needed

## License

This project is for educational and commentary purposes. Please respect the terms of service for start.gg and FGC Tools APIs.