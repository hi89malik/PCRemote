# PC Remote

A robust, cross-platform remote control application that enables you to manage your Windows PC directly from your phone's browser. It acts as an interactive trackpad, keyboard, screen viewer, and power manager over your local network.

## Features
- **Live Screen Streaming**: Experience near zero-latency desktop viewing via WebSockets and native BGRA-to-RGBA image processing.
- **Trackpad & Gestures**: Use your phone screen as a responsive mouse with single-tap (left click), two-finger tap (right click), and smooth scrolling. 
- **Keyboard Input**: Send native keystrokes, navigate with arrow keys, or send full strings of text directly to the host.
- **Remote File Explorer**: Browse your host PC's Home Directory from your phone and securely download massive files directly to your mobile device's local storage.
- **Power Management**: Remotely shutdown, sleep, or restart your system.
- **Secure Authentication**: Locked-down API and WebSocket layers using static `Basic Auth` initialized dynamically from a `.env` file. Unauthorized devices cannot control or view your desktop.

## Project Structure
```text
PCRemote/
├── index.js             # Entry point: Express server, WebSocket handlers & API auth logic
├── package.json         # Project dependencies (@nut-tree-fork/nut-js, sharp, socket.io, etc.)
├── .env                 # Environment variables for secure login
├── public/
│   ├── index.html       # Web app layout (Power, Screen Stream, Keyboard, Trackpad)
│   ├── style.css        # UI styling & glassmorphism aesthetic
│   └── script.js        # Frontend client logic (sockets, fetches, auth interceptors)
```

## Setup & Installation

**1. Clone the repository**

**2. Install Dependencies**
Make sure Node.js is installed. In the project root, run:
```bash
npm install
```
*(This will install express, socket.io, sharp for image compression, and @nut-tree-fork/nut-js for native system controls).*

**3. Configure Security**
Create a `.env` file in the root directory and set your desired credentials:
```env
REMOTE_USERNAME=admin
REMOTE_PASSWORD=admin
```

**4. Run the Server**
```bash
node index.js
```
The console will display the local IP address and port (e.g., `http://192.168.1.xxx:3000`).

## Usage
1. Ensure your mobile device is connected to the **same local Wi-Fi network** as your PC.
2. Open your mobile browser and navigate to the IP address printed in your PC's terminal.
3. Enter your configured Username and Password in the security overlay. (Defaults to `admin/admin` if unset).
4. You now have full control over your PC! 

## How It Works
- **System Control (`@nut-tree-fork/nut-js`)**: Interacts natively with the Windows OS to emit hardware-level keyboard and mouse commands. Screen captures are executed iteratively via `screen.grab()`.
- **Screen Processing (`sharp`)**: Frame buffers grabbed from the host OS are translated from `BGRA` to `RGBA` logic, resized for mobile processing, compressed into lightweight `JPEG` formats inside Node, and emitted rapidly.
- **WebSockets (`socket.io`)**: Provides real-time two-way traversal for precise trackpad location polling and image data handling.
- **Authentication**: `express` and `socket.io` middlewares intercept incoming transactions. The browser-side leverages native `window.fetch` overrides to seamlessly bundle Base64 encoded auth tokens with every background request.
