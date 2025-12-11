import React, { useState, useEffect } from 'react';
import { fetchCloudGallery, getWorkerUrl, setWorkerUrl } from '../services/cloudService';

const Gallery = ({ localGallery, onSelectThread, onClose, onImportCloudThread }) => {
  const [activeTab, setActiveTab] = useState('local'); // 'local' or 'cloud'
  const [cloudThreads, setCloudThreads] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [workerUrlInput, setWorkerUrlInput] = useState(getWorkerUrl() || '');
  const [isConfiguring, setIsConfiguring] = useState(!getWorkerUrl());

  useEffect(() => {
    if (activeTab === 'cloud' && !isConfiguring && getWorkerUrl()) {
      loadCloudGallery();
    }
  }, [activeTab, isConfiguring]);

  const loadCloudGallery = async () => {
    setLoadingCloud(true);
    const threads = await fetchCloudGallery();
    setCloudThreads(threads);
    setLoadingCloud(false);
  };

  const handleSaveConfig = () => {
    setWorkerUrl(workerUrlInput);
    setIsConfiguring(false);
    if (activeTab === 'cloud') loadCloudGallery();
  };

  const renderThreadCard = (thread, isCloud) => (
    <div key={thread.id} className="gallery-card" onClick={() => isCloud ? onImportCloudThread(thread.id) : onSelectThread(thread)}>
      <div className="card-header">
        <span className="card-title">{thread.title || 'Untitled'}</span>
        <span className="card-date">{new Date(thread.timestamp).toLocaleDateString()}</span>
      </div>
      
      {thread.thumbnail && (
        <div className="card-thumbnail">
          <img src={thread.thumbnail} alt="thumbnail" />
        </div>
      )}
      
      <div className="card-meta">
        <span>{thread.turnCount || (thread.conversation ? thread.conversation.length : '?')} turns</span>
        <span>{thread.model}</span>
      </div>

      {thread.forkInfo && (
        <div className="card-fork-info">
          Forked from {thread.forkInfo.parentId?.slice(0, 8)}...
        </div>
      )}
    </div>
  );

  return (
    <div className="gallery-overlay">
      <div className="gallery-container">
        <div className="gallery-header">
          <h2>📚 Thread Gallery</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="gallery-tabs">
          <button 
            className={`tab ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveTab('local')}
          >
            Local ({localGallery.length})
          </button>
          <button 
            className={`tab ${activeTab === 'cloud' ? 'active' : ''}`}
            onClick={() => setActiveTab('cloud')}
          >
            Cloud (Global)
          </button>
        </div>

        <div className="gallery-content">
          {activeTab === 'local' ? (
            <div className="gallery-grid">
              {localGallery.length === 0 ? (
                <div className="empty-state">No local threads saved yet.</div>
              ) : (
                localGallery.map(t => renderThreadCard(t, false))
              )}
            </div>
          ) : (
            <div className="cloud-section">
              {isConfiguring ? (
                <div className="config-panel">
                  <p>To use Cloud Gallery, deploy the provided Worker script to Cloudflare and enter the URL here.</p>
                  <input 
                    type="text" 
                    placeholder="https://your-worker.workers.dev" 
                    value={workerUrlInput}
                    onChange={(e) => setWorkerUrlInput(e.target.value)}
                  />
                  <button className="primary-button" onClick={handleSaveConfig}>Save Configuration</button>
                </div>
              ) : (
                <>
                  <div className="cloud-controls">
                     <button className="secondary-button" onClick={() => setIsConfiguring(true)}>⚙️ Config</button>
                     <button className="secondary-button" onClick={loadCloudGallery}>🔄 Refresh</button>
                  </div>
                  {loadingCloud ? (
                    <div className="loading">Loading cloud threads...</div>
                  ) : (
                    <div className="gallery-grid">
                      {cloudThreads.length === 0 ? (
                        <div className="empty-state">No cloud threads found.</div>
                      ) : (
                        cloudThreads.map(t => renderThreadCard(t, true))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .gallery-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          z-index: 1000;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .gallery-container {
          background: var(--background-base);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          width: 100%;
          max-width: 900px;
          height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .gallery-header {
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .close-button {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 2rem;
          cursor: pointer;
        }
        .gallery-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
        }
        .tab {
          flex: 1;
          padding: 15px;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .tab.active {
          color: var(--accent-primary);
          border-bottom: 2px solid var(--accent-primary);
          background: rgba(255,255,255,0.02);
        }
        .gallery-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
        }
        .gallery-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .gallery-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,0,0,0.3);
          background: rgba(255,255,255,0.08);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }
        .card-title {
          font-weight: bold;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        .card-date {
          color: var(--text-secondary);
          font-size: 0.8rem;
        }
        .card-thumbnail img {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        .card-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .card-fork-info {
          font-size: 0.7rem;
          color: var(--accent-primary);
          margin-top: 6px;
          font-style: italic;
        }
        .config-panel {
          padding: 20px;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          text-align: center;
        }
        .config-panel input {
          margin: 10px 0;
          width: 80%;
        }
        .cloud-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
};

export default Gallery;

