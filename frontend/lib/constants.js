export const VIOLATION_TYPES = {
  no_workwear: '未穿指定蓝色工作服',
  smoking: '抽烟',
  sleeping: '睡岗',
};

export const DETECTION_LABELS = {
  person: '人员',
  workwear: '指定蓝色工作服',
  no_workwear: '未穿指定蓝色工作服',
  smoking: '抽烟',
  sleep: '睡岗',
};

export function getViolationText(type) {
  return VIOLATION_TYPES[type] || type;
}

export function getDetectionLabel(className) {
  return DETECTION_LABELS[className] || className;
}
