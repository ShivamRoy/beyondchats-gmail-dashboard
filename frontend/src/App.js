import { useState, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';

const cleanEmail = (sender) => (sender && sender.match(/<(.+?)>/)?.[1]) || sender || '';

function App() {
  const [emails, setEmails] = useState([]);
  const [days, setDays] = useState(7);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [thread, setThread] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('gmail_token') || '');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    if (accessToken) {
      localStorage.setItem('gmail_token', accessToken);
      setToken(accessToken);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetch('http://localhost:8000/emails')
      .then((res) => res.json())
      .then((data) => setEmails(data))
      .catch(() => setEmails([]));
  }, []);

  const syncEmails = () => {
    if (!token) return;
    fetch(`http://127.0.0.1:8000/fetch-emails?days=${days}&token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => console.log(data));
  };

  const openThread = (threadId) => {
    fetch(`http://127.0.0.1:8000/thread/${threadId}`)
      .then((res) => res.json())
      .then((data) => setThread(data));
  };

  const handleReply = () => {
    if (!replyingTo || !replyBody.trim()) return;
    const to = cleanEmail(replyingTo.sender);
    fetch('http://127.0.0.1:8000/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        thread_id: replyingTo.thread_id,
        to,
        subject: replyingTo.subject,
        message: replyBody.trim(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setReplyingTo(null);
          setReplyBody('');
        }
      })
      .catch(console.error);
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="http://localhost:8000/auth/google"
          rel="noopener noreferrer"
        >
          Login with Google
        </a>
        {!token && (
          <p style={{ fontSize: 14, color: '#f88' }}>
            Login with Google to sync and reply. You will be redirected back here with the token.
          </p>
        )}
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <select onChange={(e) => setDays(e.target.value)}>
          <option value="7">Last 7 Days</option>
          <option value="15">Last 15 Days</option>
          <option value="30">Last 30 Days</option>
        </select>
        <button onClick={syncEmails}>Sync Emails</button>
        {emails.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Subject</th>
                <th>Attachments</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id}>
                  <td>{email.sender}</td>
                  <td>{email.receiver}</td>
                  <td>{email.subject}</td>
                  <td>
                    {email.attachments && email.attachments.length > 0
                      ? email.attachments.map((a, i) => (
                          <span key={i} title={a.filename}>
                            {a.filename}
                            {i < email.attachments.length - 1 ? ', ' : ''}
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td>
                    <button type="button" onClick={() => openThread(email.thread_id)}>
                      View thread
                    </button>
                    <button type="button" onClick={() => setReplyingTo(email)}>
                      Reply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {thread && thread.length > 0 && (
          <div style={{ marginTop: 20, textAlign: 'left', maxWidth: 700 }}>
            <p><strong>Thread ({thread.length} messages)</strong></p>
            <button type="button" onClick={() => setThread(null)}>Close thread</button>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {thread.map((msg) => (
                <li key={msg.id} style={{ borderBottom: '1px solid #444', padding: '8px 0' }}>
                  <strong>From:</strong> {msg.sender} | <strong>To:</strong> {msg.receiver}<br />
                  <strong>Subject:</strong> {msg.subject}
                </li>
              ))}
            </ul>
          </div>
        )}
        {replyingTo && (
          <div style={{ marginTop: 20, textAlign: 'left', maxWidth: 500 }}>
            <p><strong>Reply to: {replyingTo.subject}</strong></p>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Type your reply..."
              rows={4}
              style={{ width: '100%', display: 'block', marginBottom: 8 }}
            />
            <button type="button" onClick={handleReply}>Send Reply</button>
            <button type="button" onClick={() => { setReplyingTo(null); setReplyBody(''); }}>Cancel</button>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
