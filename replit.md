# Overview

BitTrader Pro is an advanced Bitcoin trading platform that combines real-time market data analysis with machine learning-based trading signals. The application provides a comprehensive trading dashboard with technical indicators, confidence scoring, risk management, and backtesting capabilities. It features a real-time WebSocket connection for live market updates, sophisticated ML-driven trading strategies, and a modern React-based interface built with shadcn/ui components.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built using React with TypeScript and follows a modern component-based architecture. It uses Vite for development and build tooling, with the following key patterns:

- **Component Structure**: Uses shadcn/ui components for consistent UI design with a dark theme trading interface
- **State Management**: Implements TanStack Query for server state management and caching, with custom hooks for trading-specific data
- **Real-time Updates**: WebSocket integration for live market data, price updates, and trading signals
- **Routing**: Uses Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with CSS custom properties for theming, including specialized trading UI classes for price movements and PnL display

## Backend Architecture
The server follows an Express.js-based REST API architecture with WebSocket support:

- **API Structure**: RESTful endpoints for market data, trading signals, backtesting, and strategy management
- **Real-time Communication**: WebSocket server for broadcasting live price updates, confidence scores, and trading signals
- **Service Layer**: Modular services for trading engine, price feed simulation, and ML prediction
- **Data Processing**: Technical indicator calculations, confidence scoring, and strategy execution logic

## Trading Engine Design
The core trading system implements a multi-factor confidence scoring model:

- **Strategy Weights**: Configurable weights for momentum (35%), volume (30%), trend (18%), and volatility (17%)
- **Technical Indicators**: EMA crossovers, StochRSI, volume analysis, and PVSRA patterns
- **Signal Generation**: Long/short signals based on confluence of technical factors
- **Risk Management**: Stop-loss, take-profit, and position sizing with dynamic adjustments

## Data Storage Solutions
Uses Drizzle ORM with PostgreSQL for data persistence:

- **Schema Design**: Normalized tables for users, price data, technical indicators, trading signals, trades, and backtest results
- **Real-time Storage**: In-memory caching for current market state and active trading data
- **Time-series Data**: Structured storage for OHLCV data across multiple timeframes

## External Dependencies

- **Neon Database**: PostgreSQL database hosting with serverless architecture
- **OpenAI API**: GPT-5 integration for advanced market analysis and prediction (with fallback to mathematical models)
- **shadcn/ui Components**: Comprehensive UI component library built on Radix UI primitives
- **TanStack Query**: Server state management and caching
- **Drizzle ORM**: Type-safe database operations and migrations
- **WebSocket (ws)**: Real-time bidirectional communication
- **Tailwind CSS**: Utility-first CSS framework with custom trading theme
- **React Hook Form**: Form state management with validation
- **Date-fns**: Date manipulation and formatting utilities