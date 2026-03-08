import { useState, useEffect } from 'react';
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
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>Gmail Integration Dashboard</h1>
        </header>

        <div className="control-bar">
          <a
            className="btn btn-primary"
            href="http://localhost:8000/auth/google"
            rel="noopener noreferrer"
          >
            Login with Google
          </a>
          <select
            className="control-select"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">Last 7 Days</option>
            <option value="15">Last 15 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={syncEmails} disabled={!token}>
            Sync Emails
          </button>
        </div>

        {!token && (
          <p className="hint-message">
            Login with Google to sync and reply. You will be redirected back here with the token.
          </p>
        )}

        <main className="dashboard-main">
        {emails.length > 0 && (
          <div className="table-wrapper">
            <table className="email-table">
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
                  <td className="col-attachments">
                    {email.attachments && email.attachments.length > 0
                      ? email.attachments.map((a, i) => (
                          <span key={i} title={a.filename}>
                            {a.filename}
                            {i < email.attachments.length - 1 ? ', ' : ''}
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td className="col-actions">
                    <button type="button" className="btn btn-view-thread" onClick={() => openThread(email.thread_id)}>
                      View thread
                    </button>
                    <button type="button" className="btn btn-reply" onClick={() => setReplyingTo(email)}>
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
          <div className="panel thread-panel">
            <p className="thread-title">Thread ({thread.length} messages)</p>
            <button type="button" className="btn btn-secondary" onClick={() => setThread(null)}>Close thread</button>
            <ul className="thread-list">
              {thread.map((msg) => (
                <li key={msg.id} className="thread-item">
                  <strong>From:</strong> {msg.sender} | <strong>To:</strong> {msg.receiver}<br />
                  <strong>Subject:</strong> {msg.subject}
                </li>
              ))}
            </ul>
          </div>
        )}
        {replyingTo && (
          <div className="panel reply-panel">
            <p><strong>Reply to: {replyingTo.subject}</strong></p>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Type your reply..."
              rows={4}
              className="reply-textarea"
            />
            <div className="reply-actions">
            <button type="button" className="btn btn-primary" onClick={handleReply}>Send Reply</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setReplyingTo(null); setReplyBody(''); }}>Cancel</button>
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

export default App;
