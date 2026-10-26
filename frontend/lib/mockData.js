/**
 * Mock data for fallback when API fails
 */

export const MOCK_STATS = {
  total: 0,
  handled: 0,
  cameras: 0
};

export const MOCK_ALARMS = [];

export const MOCK_CAMERAS = [
  { id: 1, name: 'Demo Camera', rtsp_url: '', location: 'Demo', status: 'offline', is_usb: false }
];

export const MOCK_DETECTIONS = [];

export const MOCK_VIOLATIONS = [];

/**
 * Get mock stats data
 */
export function getMockStats() {
  return {
    total: Math.floor(Math.random() * 50),
    handled: Math.floor(Math.random() * 30),
    cameras: 0
  };
}

/**
 * Get mock alarms data  
 */
export function getMockAlarms(limit = 10) {
  return MOCK_ALARMS.slice(0, limit);
}

/**
 * Get mock cameras data
 */
export function getMockCameras() {
  return MOCK_CAMERAS;
}

/**
 * Generate mock detections (for testing)
 */
export function getMockDetections() {
  return [];
}