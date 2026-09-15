/**
 * ThermoLogic – ESP32 Heat-Index Feedback Controller (reference sketch)
 *
 * Reads T+RH → NWS Heat Index → hysteresis + setpoint-shift + dry bias → AC command.
 * Replace sensor/IR stubs with your hardware.
 */
#include <math.h>

const char* COMFORT_PREF = "comfortable";
float hiMin = 24.0, hiMax = 26.5;

void loadComfortBand() {
  if (strcmp(COMFORT_PREF, "cool") == 0) { hiMin = 23.0; hiMax = 25.5; }
  else if (strcmp(COMFORT_PREF, "warm") == 0) { hiMin = 25.0; hiMax = 27.5; }
  else { hiMin = 24.0; hiMax = 26.5; }
}

float calculateHeatIndex(float tempC, float humidity) {
  float T = (tempC * 9.0 / 5.0) + 32.0;
  float RH = humidity;
  if (T < 80.0) return tempC;
  const float c1=-42.379, c2=2.04901523, c3=10.14333127, c4=-0.22475541;
  const float c5=-0.00683783, c6=-0.05481717, c7=0.00122874, c8=0.00085282, c9=-0.00000199;
  float HI = c1+(c2*T)+(c3*RH)+(c4*T*RH)+(c5*T*T)+(c6*RH*RH)+(c7*T*T*RH)+(c8*T*RH*RH)+(c9*T*T*RH*RH);
  if (RH < 13 && T >= 80 && T <= 112)
    HI -= ((13-RH)/4.0)*sqrt((17-abs(T-95.0))/17.0);
  else if (RH > 85 && T >= 80 && T <= 87)
    HI += ((RH-85.0)/10.0)*((87.0-T)/5.0);
  return (HI-32.0)*5.0/9.0;
}

enum Mode { IDLE, COOL, DRY, HEAT };
Mode currentMode = IDLE;
const unsigned long SAMPLE_MS = 60000UL;
unsigned long lastSample = 0;

void readSensors(float &tempC, float &rh) { tempC = 28.0; rh = 65.0; } // TODO: DHT/BME280
void sendAcCommand(Mode m, float setpointC, int fanSpeed) {
  Serial.printf("CMD mode=%d setpoint=%.1f fan=%d\n", (int)m, setpointC, fanSpeed);
}

void setup() {
  Serial.begin(115200);
  loadComfortBand();
  Serial.println("ThermoLogic ESP32 Heat-Index controller ready");
}

void loop() {
  if (millis() - lastSample < SAMPLE_MS) { delay(100); return; }
  lastSample = millis();
  float tempC, rh;
  readSensors(tempC, rh);
  float feels = calculateHeatIndex(tempC, rh);

  float targetDryMax = 25.0;
  bool preferDry = false;
  if (rh > 62.0) { targetDryMax = 26.5; preferDry = true; }
  else if (rh > 55.0) { targetDryMax = 25.8; preferDry = true; }

  Mode next = currentMode;
  if (feels >= hiMax + 0.3 || tempC >= targetDryMax + 0.4)
    next = preferDry ? DRY : COOL;
  else if (feels <= hiMin - 0.3)
    next = HEAT;
  else if ((currentMode == COOL || currentMode == DRY) && feels <= hiMax - 0.6 && tempC <= targetDryMax)
    next = currentMode;
  else if ((currentMode == COOL || currentMode == DRY) && feels < hiMax - 1.0)
    next = IDLE;
  else if (currentMode == HEAT && feels >= hiMin + 0.6)
    next = IDLE;

  if (next != currentMode) {
    currentMode = next;
    int fan = (currentMode == DRY) ? 1 : 2;
    float sp = (currentMode == DRY || currentMode == COOL) ? targetDryMax - 1.0 : 24.0;
    sendAcCommand(currentMode, sp, fan);
  }
  Serial.printf("T=%.1f RH=%.0f Feels=%.1f Mode=%d\n", tempC, rh, feels, (int)currentMode);
}
