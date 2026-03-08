import { useState, useEffect, useRef } from 'react';
import './App.css';

const cleanEmail = (sender) => (sender && sender.match(/<(.+?)>/)?.[1]) || sender || '';

function App() {
  const [emails, setEmails] = useState([]);
  const [days, setDays] = useState(7);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [thread, setThread] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('gmail_token') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const threadContainerRef = useRef(null);
  const replyContainerRef = useRef(null);

  const clearSession = () => {
    localStorage.removeItem('gmail_token');
    setToken('');
    setSessionExpired(true);
  };

  const isAuthError = (res, data) => {
    if (res.status === 401 || res.status === 403) return true;
    if (data && typeof data === 'object' && data.error) {
      const msg = String(data.error).toLowerCase();
      if (msg.includes('token') || msg.includes('unauthorized') || msg.includes('invalid') || msg.includes('expired')) return true;
    }
    return false;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    if (accessToken) {
      localStorage.setItem('gmail_token', accessToken);
      setToken(accessToken);
      setSessionExpired(false);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetch('http://localhost:8000/emails')
      .then((res) => res.json().then((data) => ({ res, data })).catch(() => ({ res, data: null })))
      .then(({ res, data }) => {
        if (res.status === 401 || res.status === 403) {
          clearSession();
          return;
        }
        if (data && Array.isArray(data)) setEmails(data);
      })
      .catch(() => setEmails([]));
  }, []);

  useEffect(() => {
    if (thread && thread.length > 0 && threadContainerRef.current) {
      threadContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [thread]);

  useEffect(() => {
    if (replyingTo && replyContainerRef.current) {
      replyContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [replyingTo]);

  const syncEmails = () => {
    if (!token) return;
    setIsSyncing(true);
    setSyncMessage(null);
    fetch(`http://127.0.0.1:8000/fetch-emails?days=${days}&token=${encodeURIComponent(token)}`)
      .then((res) => res.json().then((data) => ({ res, data })).catch(() => ({ res, data: null })))
      .then(({ res, data }) => {
        if (isAuthError(res, data)) {
          clearSession();
          setIsSyncing(false);
          return;
        }
        if (!res.ok) throw new Error('Sync failed');
        setIsSyncing(false);
        setSyncMessage('success');
        fetch('http://localhost:8000/emails')
          .then((r) => r.json())
          .then((list) => setEmails(list))
          .catch(() => {});
        setTimeout(() => setSyncMessage(null), 4000);
      })
      .catch(() => {
        setIsSyncing(false);
        setSyncMessage('error');
        setTimeout(() => setSyncMessage(null), 4000);
      });
  };

  const openThread = (threadId) => {
    fetch(`http://127.0.0.1:8000/thread/${threadId}`)
      .then((res) => res.json().then((data) => ({ res, data })).catch(() => ({ res, data: null })))
      .then(({ res, data }) => {
        if (isAuthError(res, data)) {
          clearSession();
          return;
        }
        setThread(Array.isArray(data) ? data : []);
      })
      .catch(() => setThread([]));
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
      .then((res) => res.json().then((data) => ({ res, data })).catch(() => ({ res, data: null })))
      .then(({ res, data }) => {
        if (isAuthError(res, data)) {
          clearSession();
          return;
        }
        if (data && data.success) {
          setReplyingTo(null);
          setReplyBody('');
        }
      })
      .catch(() => {});
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={syncEmails}
            disabled={!token || isSyncing}
          >
            {isSyncing ? (
              <>
                <span className="sync-spinner" aria-hidden />
                Syncing...
              </>
            ) : (
              'Sync Emails'
            )}
          </button>
          {syncMessage && (
            <span className={`sync-feedback sync-feedback--${syncMessage}`}>
              {syncMessage === 'success' ? 'Emails synced successfully.' : 'Failed to sync emails.'}
            </span>
          )}
        </div>

        {sessionExpired && (
          <div className="session-expired-banner">
            <p className="session-expired-message">
              Your Gmail session has expired. Please reconnect your Gmail account.
            </p>
            <a
              className="btn btn-primary"
              href="http://localhost:8000/auth/google"
              rel="noopener noreferrer"
              onClick={() => setSessionExpired(false)}
            >
              Reconnect Gmail
            </a>
          </div>
        )}

        {!token && !sessionExpired && (
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
          <div ref={threadContainerRef} className="panel thread-panel thread-container">
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
          <div ref={replyContainerRef} className="panel reply-panel reply-container">
            <p className="reply-panel-title"><strong>Reply to: {replyingTo.subject}</strong></p>
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
