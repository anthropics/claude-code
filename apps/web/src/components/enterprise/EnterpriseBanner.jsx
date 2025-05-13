import React, { useState, useEffect } from 'react';
import { useMemory } from "./profile/MemoryProvider";

/**
 * Enterprise Banner Component
 * 
 * Displays an enterprise banner at the top of the application
 * showing enterprise status, license information, and quick actions.
 */
const EnterpriseBanner = ({ showDetails = false }) => {
  const { getEnterpriseStatus, getLicenseInfo } = useMemory();
  const [enterpriseStatus, setEnterpriseStatus] = useState(null);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [expanded, setExpanded] = useState(showDetails);

  // Load enterprise status and license info
  useEffect(() => {
    const loadEnterpriseData = async () => {
      try {
        const status = await getEnterpriseStatus();
        setEnterpriseStatus(status);

        if (status?.activated) {
          const license = await getLicenseInfo();
          setLicenseInfo(license);
        }
      } catch (error) {
        console.error('Error loading enterprise data:', error);
      }
    };

    loadEnterpriseData();
  }, [getEnterpriseStatus, getLicenseInfo]);

  // Calculate days until license expiration
  const getDaysRemaining = () => {
    if (\!licenseInfo?.expirationDate) return null;
    
    const today = new Date();
    const expiration = new Date(licenseInfo.expirationDate);
    const diffTime = expiration - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysRemaining = getDaysRemaining();
  
  // If not enterprise or data not loaded yet, don't show
  if (\!enterpriseStatus || \!enterpriseStatus.activated) {
    return null;
  }

  return (
    <div className={`enterprise-banner ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="enterprise-banner-header">
        <div className="enterprise-logo">
          <span className="enterprise-badge">ENTERPRISE</span>
          <span className="enterprise-version">{enterpriseStatus.version}</span>
        </div>
        
        <div className="enterprise-status">
          {licenseInfo?.activated ? (
            <span className="license-active">
              License Active
              {daysRemaining \!== null && (
                <span className="license-days">
                  {daysRemaining > 0 
                    ? `(${daysRemaining} days remaining)` 
                    : '(Expired)'}
                </span>
              )}
            </span>
          ) : (
            <span className="license-inactive">License Inactive</span>
          )}
        </div>
        
        <button 
          className="toggle-details" 
          onClick={() => setExpanded(\!expanded)}
          aria-label={expanded ? "Hide details" : "Show details"}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      
      {expanded && (
        <div className="enterprise-details">
          <div className="enterprise-info">
            <div className="info-item">
              <span className="info-label">Edition:</span>
              <span className="info-value">{enterpriseStatus.type || 'Beta'}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Activated:</span>
              <span className="info-value">
                {new Date(enterpriseStatus.activationDate).toLocaleDateString()}
              </span>
            </div>
            
            {licenseInfo && (
              <>
                <div className="info-item">
                  <span className="info-label">License Type:</span>
                  <span className="info-value">{licenseInfo.type || 'Standard'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Expiration:</span>
                  <span className="info-value">
                    {licenseInfo.expirationDate 
                      ? new Date(licenseInfo.expirationDate).toLocaleDateString() 
                      : 'N/A'}
                  </span>
                </div>
              </>
            )}
          </div>
          
          <div className="enterprise-actions">
            <button className="action-button">Manage Users</button>
            <button className="action-button">Team Settings</button>
            <button className="action-button">View Audit Logs</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseBanner;
EOF < /dev/null