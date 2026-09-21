# AeroTrace Mathematical, Physical & Algorithmic Reference Manual

This document provides a comprehensive reference for every mathematical formula, physical equation, statistical model, and geographic calculation implemented in the **AeroTrace** Air Quality & Source Attribution Platform.

---

## Table of Contents

1. [Pasquill-Gifford Atmospheric Stability & Dispersion Model](#1-pasquill-gifford-atmospheric-stability--dispersion-model)
2. [CPCB NAQS Pollutant Normalization & Exceedance Factors](#2-cpcb-naqs-pollutant-normalization--exceedance-factors)
3. [Indian CPCB National Air Quality Index (NAQI) Calculation](#3-indian-cpcb-national-air-quality-index-naqi-calculation)
4. [US EPA Sub-Index to Physical Concentration Inverse Conversion](#4-us-epa-sub-index-to-physical-concentration-inverse-conversion)
5. [Wet-Scavenging Environmental Physics Model (Precipitation Wash-Out)](#5-wet-scavenging-environmental-physics-model-precipitation-wash-out)
6. [Geodesic Distance (Haversine Formula) & Navigation Math](#6-geodesic-distance-haversine-formula--navigation-math)
7. [Dynamic Upwind Wind Cone Geometry & Point-in-Cone Filtering](#7-dynamic-upwind-wind-cone-geometry--point-in-cone-filtering)
8. [Multi-Factor Source Attribution Scoring Model](#8-multi-factor-source-attribution-scoring-model)
9. [Pre-Alert Downwind Forecasting & ETA / Impact Model](#9-pre-alert-downwind-forecasting--eta--impact-model)
10. [Machine Learning Isolation Forest Anomaly Detection Model](#10-machine-learning-isolation-forest-anomaly-detection-model)
11. [Rate-of-Change (RoC) AQI Spike Detection Rule](#11-rate-of-change-roc-aqi-spike-detection-rule)
12. [Chemical Fingerprinting & Co-Pollutant Ratio Classification Tree](#12-chemical-fingerprinting--co-pollutant-ratio-classification-tree)
13. [Mixing Layer Height (MLH) Planetary Boundary Layer Model](#13-mixing-layer-height-mlh-planetary-boundary-layer-model)
14. [16-Point Cardinal Wind Direction Compass Conversion](#14-16-point-cardinal-wind-direction-compass-conversion)
15. [OpenWeatherMap Micro-Environmental Scaling & Consensus Averaging](#15-openopenweathermap-micro-environmental-scaling--consensus-averaging)

---

## 1. Pasquill-Gifford Atmospheric Stability & Dispersion Model

### Codebase Location
- **Files**: [`pipeline/pasquill.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/pasquill.py#L31-L101) (Lines 31–101) & [`pipeline/weather_client.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/weather_client.py#L154-L195) (Lines 154–195)
- **Functions / Structures**: `STABILITY_TABLE`, `classify_stability()`, `StabilityProfile`

### Mathematical Formulation
The Pasquill-Gifford (P-G) classification categorizes atmospheric stability into 6 distinct classes ($A$ through $F$) based on surface wind speed $u$ (in $\text{km/h}$) and daytime/nighttime solar radiation proxies (hour $h$ where daytime is defined as $6 \le h < 18$):

$$\text{Class}(u, h) = \begin{cases} 
A \text{ (Day)} \;\Big|\; F \text{ (Night)} & \text{if } u < 5\text{ km/h} \\
B \text{ (Day)} \;\Big|\; E \text{ (Night)} & \text{if } 5 \le u < 15\text{ km/h} \\
C \text{ (Day)} \;\Big|\; D \text{ (Night)} & \text{if } 15 \le u < 25\text{ km/h} \\
D \text{ (Day \& Night)} & \text{if } u \ge 25\text{ km/h}
\end{cases}$$

Each stability class maps to horizontal ($\sigma_y$) and vertical ($\sigma_z$) Gaussian plume dispersion coefficients (dimensionless scaling factors):

| Pasquill Class | Stability Category | $\sigma_y$ | $\sigma_z$ | Environmental Description |
| :---: | :--- | :---: | :---: | :--- |
| **A** | Extremely Unstable | $0.40$ | $0.25$ | Strong solar heating, low wind; rapid vertical/horizontal lofting |
| **B** | Moderately Unstable | $0.32$ | $0.16$ | Moderate solar radiation, active convective mixing |
| **C** | Slightly Unstable | $0.22$ | $0.11$ | Broken clouds or moderate wind; mechanical + convective mixing |
| **D** | Neutral | $0.22$ | $0.08$ | Overcast or high wind ($u \ge 25\,\text{km/h}$); mechanical mixing |
| **E** | Slightly Stable | $0.18$ | $0.06$ | Nighttime moderate wind; limited vertical mixing |
| **F** | Moderately Stable | $0.12$ | $0.04$ | Clear night, low wind; strong thermal inversion, pollutants pool |

### Technical Explanation & Scientific Foundation
In industrial atmospheric dispersion physics (Gaussian Plume Model), the concentration $C(x,y,z)$ downwind of a point source depends inversely on $\sigma_y \cdot \sigma_z \cdot u$. Unstable conditions ($A$) produce strong thermal eddies that spread plumes vertically and horizontally, whereas stable conditions ($F$) trap emissions near the surface under a nocturnal temperature inversion layer.

### Practical Application in AeroTrace
In AeroTrace, the Pasquill class determines the horizontal spread parameter $\sigma_y$ and reach parameters when constructing upwind wind cone features in `pipeline/cone_builder.py` and `pipeline/attribution.py`. Under Class $F$ (stable night), plumes do not dilate quickly, so high pollution concentrations persist over longer ground-level paths.

### Numerical Example
- **Inputs**: Wind speed $u = 12.0\,\text{km/h}$, Local Hour $h = 14$ (2:00 PM IST $\Rightarrow \text{Day}$).
- **Step 1**: $5 \le 12.0 < 15 \Rightarrow$ Select daytime class **B** (Moderately Unstable).
- **Step 2**: Look up class **B** parameters: $\sigma_y = 0.32$, $\sigma_z = 0.16$.

---

## 2. CPCB NAQS Pollutant Normalization & Exceedance Factors

### Codebase Location
- **File**: [`pipeline/naaqs.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/naaqs.py#L25-L84) (Lines 25–84)
- **Functions / Structures**: `PollutantStandard.exceedance_factor()`, `compute_exceedance_factors()`, `dominant_pollutant()`

### Mathematical Formulation
The Exceedance Factor ($\text{EF}$) normalizes a measured pollutant concentration $C_p$ against its legal Indian National Ambient Air Quality Standard limit ($L_{\text{NAAQS}}$):

$$\text{EF}_p = \text{round}\left( \frac{C_p}{L_{\text{NAAQS}, p}} + 10^{-9}, \; 2 \right)$$

where $10^{-9}$ is an epsilon term preventing half-way floating point rounding bias. The standard limits $L_{\text{NAAQS}, p}$ defined by the Central Pollution Control Board (CPCB 2009) are:

$$\begin{aligned}
L_{\text{PM2.5}} &= 60.0 \;\mu\text{g/m}^3 \quad (24\text{-hr average}) \\
L_{\text{PM10}}  &= 100.0 \;\mu\text{g/m}^3 \quad (24\text{-hr average}) \\
L_{\text{NO2}}   &= 80.0 \;\mu\text{g/m}^3 \quad (24\text{-hr average}) \\
L_{\text{SO2}}   &= 80.0 \;\mu\text{g/m}^3 \quad (24\text{-hr average}) \\
L_{\text{CO}}    &= 4.0 \;\text{mg/m}^3 \quad (8\text{-hr average}) \\
L_{\text{O3}}    &= 100.0 \;\mu\text{g/m}^3 \quad (8\text{-hr average})
\end{aligned}$$

The **dominant pollutant** $p^*$ is defined as the species exhibiting the maximum exceedance factor:

$$p^* = \arg\max_{p \in \{\text{pm25, pm10, no2, so2, co, o3}\}} \left( \text{EF}_p \right)$$

### Technical Explanation & Scientific Foundation
Raw ambient monitoring data contains disparate dimensional units ($\mu\text{g/m}^3$ vs $\text{mg/m}^3$). Computing the unitless Exceedance Factor standardizes health impact assessments:
- $\text{EF} < 1.0$: Concentration complies with statutory limits.
- $\text{EF} \ge 1.0$: Concentration violates statutory limit.
- $\text{EF} \ge 1.5$: Triggers automatic baseline spike alerts in AeroTrace.

### Practical Application in AeroTrace
Exceedance factors serve as the standardized feature vector for the **Chemical Fingerprint Engine** (`pipeline/spike_detector.py`) and determine the primary display driver (`dominant_pollutant`) in the lower UI dashboard.

### Numerical Example
- **Inputs**: $\text{PM}_{2.5} = 148.6 \;\mu\text{g/m}^3$, $\text{PM}_{10} = 195.0 \;\mu\text{g/m}^3$, $\text{NO}_2 = 42.0 \;\mu\text{g/m}^3$.
- **Step 1**:
  $$\text{EF}_{\text{PM2.5}} = \text{round}\left(\frac{148.6}{60.0}, 2\right) = 2.48$$
  $$\text{EF}_{\text{PM10}} = \text{round}\left(\frac{195.0}{100.0}, 2\right) = 1.95$$
  $$\text{EF}_{\text{NO2}} = \text{round}\left(\frac{42.0}{80.0}, 2\right) = 0.53$$
- **Step 2**: $\max(2.48, 1.95, 0.53) = 2.48 \Rightarrow$ Dominant Pollutant = `PM25` with $\text{EF} = 2.48$.

---

## 3. Indian CPCB National Air Quality Index (NAQI) Calculation

### Codebase Location
- **File**: [`pipeline/cpcb_poller.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/cpcb_poller.py#L500-L603) (Lines 500–603)
- **Function**: `calculate_indian_aqi()`

### Mathematical Formulation
The sub-index $I_p$ for a pollutant concentration $C_p$ is calculated using the official Indian CPCB piecewise linear interpolation formula across 6 breakpoint concentration intervals $[B_{\text{lo}}, B_{\text{hi}}]$ and corresponding AQI band limits $[I_{\text{lo}}, I_{\text{hi}}]$:

$$I_p = I_{\text{lo}} + \frac{I_{\text{hi}} - I_{\text{lo}}}{B_{\text{hi}} - B_{\text{lo}}} \cdot (C_p - B_{\text{lo}})$$

The final composite National Air Quality Index ($\text{AQI}$) is the maximum of all valid sub-indices:

$$\text{AQI} = \max_{p} \left( I_p \right)$$

#### Breakpoint Table ($B_{\text{lo}} - B_{\text{hi}}$) per Pollutant

| AQI Category | AQI Band ($I_{\text{lo}} - I_{\text{hi}}$) | $\text{PM}_{2.5}$ ($\mu\text{g/m}^3$) | $\text{PM}_{10}$ ($\mu\text{g/m}^3$) | $\text{NO}_2$ ($\mu\text{g/m}^3$) | $\text{SO}_2$ ($\mu\text{g/m}^3$) | $\text{CO}$ ($\text{mg/m}^3$) | $\text{O}_3$ ($\mu\text{g/m}^3$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Good** | $0 - 50$ | $0 - 30$ | $0 - 50$ | $0 - 40$ | $0 - 40$ | $0.0 - 1.0$ | $0 - 50$ |
| **Satisfactory** | $51 - 100$ | $31 - 60$ | $51 - 100$ | $41 - 80$ | $41 - 80$ | $1.1 - 2.0$ | $51 - 100$ |
| **Moderate** | $101 - 200$ | $61 - 90$ | $101 - 250$ | $81 - 180$ | $81 - 380$ | $2.1 - 10.0$ | $101 - 168$ |
| **Poor** | $201 - 300$ | $91 - 120$ | $251 - 350$ | $181 - 280$ | $381 - 800$ | $10.1 - 17.0$ | $169 - 208$ |
| **Very Poor** | $301 - 400$ | $121 - 250$ | $351 - 430$ | $281 - 400$ | $801 - 1600$ | $17.1 - 34.0$ | $209 - 748$ |
| **Severe** | $401 - 500$ | $> 250$ | $> 430$ | $> 400$ | $> 1600$ | $> 34.0$ | $> 748$ |

### Technical Explanation & Scientific Foundation
CPCB NAQI maps non-linear epidemiological risk curves of different ambient pollutants into a unified 0–500 scale. Sub-index slope discontinuities reflect threshold concentrations where acute health impacts (respiratory, cardiovascular) accelerate.

### Practical Application in AeroTrace
`calculate_indian_aqi()` acts as the central AQI engine when parsing ingested telemetry from OpenWeatherMap Air Pollution API or raw sensor arrays, ensuring that AeroTrace displays mathematically compliant Indian AQI values regardless of upstream telemetry sources.

### Numerical Example
- **Input**: $\text{PM}_{2.5} = 75.0 \;\mu\text{g/m}^3$.
- **Step 1**: $75.0 \;\mu\text{g/m}^3$ falls in the **Moderate** band ($61 - 90$).
- **Step 2**: $B_{\text{lo}} = 60.0$, $B_{\text{hi}} = 90.0$, $I_{\text{lo}} = 100$, $I_{\text{hi}} = 200$.
- **Step 3**:
  $$I_{\text{PM2.5}} = 100 + \frac{200 - 100}{90 - 60} \cdot (75.0 - 60.0) = 100 + \frac{100}{30} \cdot 15.0 = 100 + 50.0 = 150.0$$

---

## 4. US EPA Sub-Index to Physical Concentration Inverse Conversion

### Codebase Location
- **File**: [`pipeline/cpcb_poller.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/cpcb_poller.py#L605-L685) (Lines 605–685)
- **Function**: `us_aqi_to_concentration()`

### Mathematical Formulation
To invert a US EPA AQI sub-index $I_{\text{EPA}}$ back into a physical mass concentration $C_p$, the inverse linear interpolation formula is applied across US EPA breakpoint tables:

$$C_p = C_{\text{lo}} + \frac{I_{\text{EPA}} - I_{\text{lo}}}{I_{\text{hi}} - I_{\text{lo}}} \cdot (C_{\text{hi}} - C_{\text{lo}})$$

For gaseous pollutants measured in volume mixing ratios ($\text{ppm}$ or $\text{ppb}$), molar gas conversion factors at standard temperature ($25^\circ\text{C}$) and pressure ($1\text{ atm}$) translate mixing ratios to mass concentration ($\text{mg/m}^3$ or $\mu\text{g/m}^3$):

$$\begin{aligned}
C_{\text{CO}} \,(\text{mg/m}^3) &= \text{ppm}_{\text{CO}} \times 1.145 \\
C_{\text{NO2}} \,(\mu\text{g/m}^3) &= \text{ppb}_{\text{NO2}} \times 1.880 \\
C_{\text{SO2}} \,(\mu\text{g/m}^3) &= \text{ppb}_{\text{SO2}} \times 2.620 \\
C_{\text{O3}} \,(\mu\text{g/m}^3) &= \text{ppb}_{\text{O3}} \times 1.960
\end{aligned}$$

### Technical Explanation & Scientific Foundation
Third-party global APIs (such as World Air Quality Index - WAQI) expose telemetry normalized to the US EPA AQI standard. Because US EPA and Indian CPCB use different breakpoint thresholds and averaging periods, direct usage of US AQI in India introduces severe errors. Inverting US AQI back to physical mass density ($\mu\text{g/m}^3$) enables downstream re-processing using Indian CPCB standards.

### Practical Application in AeroTrace
Used inside `_fetch_live_waqi()` in `cpcb_poller.py` to extract raw physical concentrations from live WAQI JSON responses before consensus-averaging and Indian AQI recalculation.

### Numerical Example
- **Input**: US EPA Sub-index for $\text{NO}_2 = 75.0$.
- **Step 1**: $75.0$ falls in EPA Moderate band ($I_{\text{lo}}=51, I_{\text{hi}}=100 \Rightarrow \text{ppb}_{\text{lo}}=53.0, \text{ppb}_{\text{hi}}=100.0$).
- **Step 2**:
  $$\text{ppb}_{\text{NO2}} = 53.0 + \frac{75.0 - 50.0}{100.0 - 50.0} \cdot (100.0 - 53.0) = 53.0 + 0.5 \times 47.0 = 76.5 \;\text{ppb}$$
- **Step 3**: Convert to $\mu\text{g/m}^3$:
  $$C_{\text{NO2}} = 76.5 \times 1.88 = 143.82 \;\mu\text{g/m}^3$$

---

## 5. Wet-Scavenging Environmental Physics Model (Precipitation Wash-Out)

### Codebase Location
- **File**: [`pipeline/attribution.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/attribution.py#L40-L108) (Lines 40–108)
- **Functions / Constants**: `_apply_wet_scavenging()`, `_SCAVENGING_LAMBDA = 0.15`, `_WET_AQI_CEILING = 95`

### Mathematical Formulation
When precipitation $P$ (in $\text{mm/hr}$) exceeds the trace detection threshold ($P \ge 0.1\,\text{mm/hr}$), below-cloud particulate scavenging is modeled via first-order exponential decay:

$$R(P) = \exp(-\lambda_{\text{scav}} \cdot P)$$

where $\lambda_{\text{scav}} = 0.15 \;\text{mm}^{-1}\text{hr}$ is the below-cloud washout coefficient for coarse and fine aerosols (Seinfeld & Pandis 2016). Particulate concentrations and total AQI are adjusted accordingly:

$$\begin{aligned}
C_{\text{PM2.5, adj}} &= C_{\text{PM2.5, raw}} \cdot R(P) \\
C_{\text{PM10, adj}}  &= C_{\text{PM10, raw}} \cdot R(P) \\
\text{AQI}_{\text{effective}} &= \min\left( \text{AQI}_{\text{raw}} \cdot R(P), \; 95 \right)
\end{aligned}$$

```
Rainfall (P mm/hr)  --->  Exponential Washout Factor R = exp(-0.15 * P)
                                    |
                                    v
                       Effective AQI = min(Raw AQI * R, 95)
```

### Technical Explanation & Scientific Foundation
Falling raindrops capture suspended atmospheric particulate matter via inertial impaction, interception, and Brownian diffusion. During active precipitation, ambient particulate levels drop rapidly. Enforcing a strict ceiling of $95$ under rain prevents false high-pollution attribution triggers caused by sensor moisture interference.

### Practical Application in AeroTrace
Executed during live attribution in `run_attribution()` whenever live weather telemetry indicates rain ($P \ge 0.1\,\text{mm/hr}$). Prevents dispatching field inspection teams during active rainstorms when plumes are suppressed.

### Numerical Example
- **Inputs**: Raw $\text{AQI} = 220.0$ (Poor), Precipitation $P = 4.0 \;\text{mm/hr}$, $\text{PM}_{2.5} = 110.0 \;\mu\text{g/m}^3$.
- **Step 1**: Calculate retention factor $R(4.0)$:
  $$R(4.0) = \exp(-0.15 \times 4.0) = \exp(-0.60) \approx 0.54881$$
- **Step 2**: Adjust $\text{PM}_{2.5}$:
  $$C_{\text{PM2.5, adj}} = 110.0 \times 0.54881 = 60.37 \;\mu\text{g/m}^3$$
- **Step 3**: Adjust AQI and enforce wet ceiling ($95$):
  $$\text{AQI}_{\text{temp}} = 220.0 \times 0.54881 = 120.74$$
  $$\text{AQI}_{\text{effective}} = \min(120.74, 95) = 95.0$$

---

## 6. Geodesic Distance (Haversine Formula) & Navigation Math

### Codebase Location
- **File**: [`pipeline/attribution.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/attribution.py#L116-L145) (Lines 116–145) & [`db/geo_utils.py`](file:///d:/AeroTrace%20A%28Q%29I/db/geo_utils.py)
- **Functions**: `_haversine_m()`, `_bearing_deg()`, `_destination()`

### Mathematical Formulation
Given two points on the WGS-84 ellipsoid/sphere $P_1 = (\lambda_1, \phi_1)$ and $P_2 = (\lambda_2, \phi_2)$ in radians, with mean Earth radius $R_E = 6,371,000\,\text{m}$:

#### 1. Haversine Distance ($d_{\text{m}}$)
$$a = \sin^2\left(\frac{\phi_2 - \phi_1}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\lambda_2 - \lambda_1}{2}\right)$$
$$d_{\text{m}} = 2 R_E \cdot \arcsin\left(\sqrt{a}\right)$$

#### 2. Initial Forward Bearing ($\theta_{\text{deg}}$)
$$y = \sin(\lambda_2 - \lambda_1)\cos(\phi_2)$$
$$x = \cos(\phi_1)\sin(\phi_2) - \sin(\phi_1)\cos(\phi_2)\cos(\lambda_2 - \lambda_1)$$
$$\theta_{\text{deg}} = \left( \text{atan2}(y, x) \cdot \frac{180}{\pi} + 360 \right) \bmod 360$$

#### 3. Great-Circle Destination Point $(\lambda_2', \phi_2')$
Given start $(\lambda_1, \phi_1)$, bearing $\theta$, distance $d$:
$$\delta = \frac{d}{R_E}$$
$$\phi_2' = \arcsin\left(\sin(\phi_1)\cos(\delta) + \cos(\phi_1)\sin(\delta)\cos(\theta)\right)$$
$$\lambda_2' = \lambda_1 + \text{atan2}\left(\sin(\theta)\sin(\delta)\cos(\phi_1), \; \cos(\delta) - \sin(\phi_1)\sin(\phi_2')\right)$$

### Technical Explanation & Scientific Foundation
Computes exact spherical geodesic distance and navigation angles on Earth without heavy external C-library GIS dependencies (e.g. Shapely/GEOS). Ensures standard-library execution compatibility across Windows/Linux containers.

### Practical Application in AeroTrace
Used in Stage 1 and Stage 2 attribution funnels to compute distances from monitoring stations to candidate pollution sources, candidate bearings, and wind cone arc boundary points.

### Numerical Example
- **Inputs**: Station Shivajinagar ($73.8500^\circ\text{E}, 18.5300^\circ\text{N}$), Source ($73.8300^\circ\text{E}, 18.5500^\circ\text{N}$).
- **Step 1**: $\Delta \phi = +0.02^\circ = 0.000349 \;\text{rad}$, $\Delta \lambda = -0.02^\circ = -0.000349 \;\text{rad}$.
- **Step 2**: Evaluating Haversine yields $d_{\text{m}} \approx 3,091.2 \;\text{m}$ ($3.09 \;\text{km}$).
- **Step 3**: Evaluating Bearing yields $\theta_{\text{deg}} \approx 315.0^\circ$ (North-West).

---

## 7. Dynamic Upwind Wind Cone Geometry & Point-in-Cone Filtering

### Codebase Location
- **File**: [`pipeline/attribution.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/attribution.py#L147-L233) (Lines 147–233) & [`pipeline/cone_builder.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/cone_builder.py)
- **Functions**: `get_search_radius_m()`, `get_half_angle_deg()`, `build_wind_cone_polygon()`, `_point_in_cone()`

### Mathematical Formulation
The search reach $R_{\text{reach}}$ (in meters) and cone half-angle aperture $\alpha$ (in degrees) are dynamic functions of wind speed $u$ (in $\text{km/h}$):

$$R_{\text{reach}}(u) = \begin{cases} 
1,500\text{ m} & \text{if } u < 5\text{ km/h} \\
2,500\text{ m} & \text{if } 5 \le u < 15\text{ km/h} \\
3,500\text{ m} & \text{if } 15 \le u < 25\text{ km/h} \\
4,500\text{ m} & \text{if } u \ge 25\text{ km/h}
\end{cases}$$

$$\alpha(u) = \begin{cases} 
180.0^\circ \text{ (Calm 360}^\circ \text{ Scatter Mode)} & \text{if } u < 0.5\text{ km/h} \\
45.0^\circ & \text{if } 0.5 \le u < 5\text{ km/h} \\
30.0^\circ & \text{if } 5 \le u < 15\text{ km/h} \\
22.5^\circ & \text{if } 15 \le u < 25\text{ km/h} \\
18.0^\circ & \text{if } u \ge 25\text{ km/h}
\end{cases}$$

A candidate pollution source point $P_{\text{src}}$ lies inside the upwind cone of station $P_{\text{sta}}$ under meteorological wind direction $\theta_{\text{wind}}$ if and only if both spatial conditions hold:

$$d(P_{\text{sta}}, P_{\text{src}}) \le R_{\text{reach}}(u)$$

$$\Delta \theta = \Big| \left(\text{bearing}(P_{\text{sta}} \to P_{\text{src}}) - \theta_{\text{wind}} + 180^\circ\right) \bmod 360^\circ - 180^\circ \Big| \le \alpha(u)$$

```
                    Upwind Source Sector Polygon
                                  /
                                 /  Cone Half-Angle (alpha)
                                / \
       Station (Apex) --------> *---> Center Axis (Wind Direction FROM)
                                \ /
                                 \
                                  \
```

### Technical Explanation & Scientific Foundation
Meteorological wind direction defines the angle wind arrives **FROM**. Potential sources of a detected spike must lie **upwind** (i.e. along the direction the wind blew from). At low wind speeds ($u < 5\,\text{km/h}$), atmospheric meandering widens the plume sector ($\alpha = 45^\circ$), whereas high wind speeds ($u \ge 25\,\text{km/h}$) narrow the plume footprint down to $\alpha = 18^\circ$.

### Practical Application in AeroTrace
Stage 2 of `run_attribution()` uses `_point_in_cone()` to filter out downwind/crosswind sources, returning a clean GeoJSON `Polygon` feature rendered on the interactive Leaflet map.

### Numerical Example
- **Inputs**: Wind speed $u = 14.5 \;\text{km/h}$, Wind direction $\theta_{\text{wind}} = 290^\circ$. Source bearing $\theta_{\text{src}} = 309^\circ$, distance $d = 2,100 \;\text{m}$.
- **Step 1**: $5 \le 14.5 < 15 \Rightarrow R_{\text{reach}} = 2,500 \;\text{m}$, $\alpha = 30.0^\circ$.
- **Step 2**: Distance check: $2,100 \;\text{m} \le 2,500 \;\text{m} \Rightarrow$ PASS.
- **Step 3**: Angular difference check:
  $$\Delta \theta = |(309^\circ - 290^\circ + 180^\circ) \bmod 360^\circ - 180^\circ| = |209^\circ \bmod 360^\circ - 180^\circ| = |199^\circ - 180^\circ| = 19^\circ$$
- **Step 4**: $19^\circ \le 30.0^\circ \Rightarrow$ Source is **inside the upwind cone**.

---

## 8. Multi-Factor Source Attribution Scoring Model

### Codebase Location
- **File**: [`pipeline/attribution.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/attribution.py#L295-L355) (Lines 295–355)
- **Functions**: `_wind_alignment_score()`, `_proximity_score()`, `_temporal_match_score()`, `_chemical_match_score()`, `_composite_confidence()`, `_compliance_penalty()`

### Mathematical Formulation
Surviving candidate sources inside the wind cone are evaluated across four independent sub-scores bounded in $[0.0, 1.0]$:

#### 1. Wind Alignment Score ($S_{\text{wind}}$)
$$S_{\text{wind}} = \max\left( 0.0, \; \text{round}\left( 1.0 - \frac{\Delta \theta}{\alpha}, \; 4 \right) \right)$$

#### 2. Proximity Score ($S_{\text{prox}}$)
$$S_{\text{prox}} = \max\left( 0.0, \; \text{round}\left( 1.0 - \frac{d}{R_{\text{reach}}}, \; 4 \right) \right)$$

#### 3. Temporal Match Score ($S_{\text{temp}}$)
$$S_{\text{temp}} = \begin{cases} 
1.0 & \text{if spike time } t_{\text{spike}} \in [\text{schedule\_start}, \text{schedule\_end}] \\
0.2 & \text{otherwise}
\end{cases}$$

#### 4. Chemical Match Score ($S_{\text{chem}}$)
Looked up from the empirical chemical signature score matrix:

$$\mathbf{M}_{\text{chem}} = \begin{pmatrix}
& \text{construction} & \text{traffic} & \text{industrial} & \text{waste\_burning} \\
\text{crustal\_dominant} & 1.0 & 0.6 & 0.1 & 0.2 \\
\text{combustion\_vehicular} & 0.1 & 1.0 & 0.5 & 0.3 \\
\text{industrial\_sulfur} & 0.0 & 0.0 & 1.0 & 0.0 \\
\text{biomass\_burning} & 0.1 & 0.1 & 0.1 & 1.0 \\
\text{mixed} & 0.5 & 0.5 & 0.5 & 0.5
\end{pmatrix}$$

#### Composite Confidence Score ($C_{\text{composite}}$)
$$C_{\text{composite}} = \text{round}\left( 0.40 \cdot S_{\text{wind}} + 0.35 \cdot S_{\text{chem}} + 0.25 \cdot S_{\text{temp}}, \; 4 \right)$$

#### Compliance Penalty ($P_{\text{penalty}}$) & Enforcement Priority ($\text{EP}$)
$$P_{\text{penalty}} = \min\left( 0.20, \; 0.10 \cdot \mathbf{1}_{\text{near\_school}} + 0.05 \cdot \mathbf{1}_{\text{near\_hospital}} \right)$$

$$\text{EP} = \min\left( 1.0, \; C_{\text{composite}} + 0.10 \cdot \mathbf{1}_{\text{sensitive}} + 0.05 \cdot \text{violations}_{90\text{d}} \right)$$

#### Ambiguity Flag
$$\text{Ambiguous} = \text{True} \quad \text{if } (C_{\text{composite, Rank 1}} - C_{\text{composite, Rank 2}}) < 0.15$$

### Technical Explanation & Scientific Foundation
Multi-criteria optimization weights meteorology highest ($40\%$), followed by chemical fingerprint compatibility ($35\%$), and source operational schedule ($25\%$). Proximity acts as a secondary tie-breaker.

### Practical Application in AeroTrace
Produces the `ranked_candidates` breakdown in the lower half of the data contract payload, enabling municipal authorities to pinpoint the top offender with an audit-ready confidence score.

### Numerical Example
- **Inputs**: $\Delta \theta = 6^\circ$, $\alpha = 30^\circ$, $d = 1200\,\text{m}$, $R_{\text{reach}} = 2500\,\text{m}$. Signature = `crustal_dominant`, Source = `construction` (active at event time, near school).
- **Step 1**: $S_{\text{wind}} = 1.0 - 6/30 = 0.80$.
- **Step 2**: $S_{\text{prox}} = 1.0 - 1200/2500 = 0.52$.
- **Step 3**: $S_{\text{temp}} = 1.0$, $S_{\text{chem}} = 1.0$.
- **Step 4**:
  $$C_{\text{composite}} = 0.40(0.80) + 0.35(1.0) + 0.25(1.0) = 0.32 + 0.35 + 0.25 = 0.92 \; (92\%)$$
- **Step 5**: $P_{\text{penalty}} = 0.10$ (near school).

---

## 9. Pre-Alert Downwind Forecasting & ETA / Impact Model

### Codebase Location
- **File**: [`pipeline/forecasting.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/forecasting.py#L75-L123) (Lines 75–123)
- **Functions / Tables**: `generate_pre_alert()`, `predict_upcoming_impacts()`, `SOURCE_IMPACT_TABLE`

### Mathematical Formulation
For any source scheduled to start within a lookahead window $t_{\text{lookahead}} \le 120 \;\text{min}$, wind alignment between the source bearing $\theta_{\text{src}}$ and meteorological wind direction $\theta_{\text{wind}}$ is verified:

$$\Delta \theta_{\text{downwind}} = \Big| (\theta_{\text{src}} - \theta_{\text{wind}} + 180^\circ) \bmod 360^\circ - 180^\circ \Big| \le 45.0^\circ$$

If downwind alignment is confirmed and wind speed $v = \frac{u_{\text{km/h}}}{3.6} \ge 0.5 \;\text{m/s}$, plume travel time ($\text{ETA}_{\text{min}}$) and expected AQI increase ($\Delta \text{AQI}$) are computed:

$$\text{ETA}_{\text{min}} = \text{round}\left( \frac{d_{\text{m}} / v}{60} \right)$$

$$\Delta \text{AQI} = \text{round}\left( \text{BaseImpact}(\text{source\_type}) \cdot \max\left( 0.3, \; 1.0 - \frac{d_{\text{m}}}{3000.0} \right) \right)$$

Where base impact thresholds are:
- `construction`: $+80 \;\text{AQI}$
- `waste_burning`: $+60 \;\text{AQI}$
- `traffic`: $+50 \;\text{AQI}$
- `industrial`: $+40 \;\text{AQI}$

### Technical Explanation & Scientific Foundation
Advection travel time represents the time required for a newly emitted pollutant mass to be transported downwind by mean wind speed $v$. Linear distance decay ($1 - d/3000$) accounts for turbulent atmospheric dilution over distance.

### Practical Application in AeroTrace
Powers Task 6 Pre-Alert forecasting, emitting early advisories to local enforcement teams up to 2 hours before factories or construction sites launch daily operations.

### Numerical Example
- **Inputs**: Construction site starting in 30 mins. $d = 1,500 \;\text{m}$, $u = 18.0 \;\text{km/h} \Rightarrow v = 5.0 \;\text{m/s}$. Downwind angle $\Delta \theta = 12^\circ \le 45^\circ$.
- **Step 1**: $\text{ETA}_{\text{min}} = \frac{1500 / 5.0}{60} = \frac{300}{60} = 5 \;\text{minutes}$.
- **Step 2**: Distance decay $= \max(0.3, 1.0 - 1500/3000) = 0.50$.
- **Step 3**: $\Delta \text{AQI} = 80 \times 0.50 = +40 \;\text{AQI}$ points expected increase.

---

## 10. Machine Learning Isolation Forest Anomaly Detection Model

### Codebase Location
- **File**: [`pipeline/spike_detector.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/spike_detector.py#L238-L296) (Lines 238–296)
- **Function**: `_detect_ml_anomaly()`

### Mathematical Formulation
An unsupervised `IsolationForest` model is dynamically fitted over a 7-day rolling window of historical station telemetry $D = \{(\text{hour}_i, \text{AQI}_i)\}_{i=1}^N$:

$$\text{Model} = \text{IsolationForest}(\text{n\_estimators}=100, \; \text{contamination}=0.05, \; \text{random\_state}=42)$$

Given a new sample $\mathbf{x}_{\text{current}} = [\text{hour}_{\text{local}}, \text{AQI}_{\text{current}}]$, the isolation path length $h(\mathbf{x})$ across $T$ decision trees computes the anomaly score $s(\mathbf{x}, N)$:

$$s(\mathbf{x}, N) = 2^{-\frac{E(h(\mathbf{x}))}{c(N)}}$$

where $c(N) = 2 \ln(N - 1) + 0.5772156649 - \frac{2(N - 1)}{N}$ is the average path length of unsuccessful searches in a Binary Search Tree.

$$\text{Verdict} = \begin{cases} 
\text{Spike Triggered} & \text{if } \text{prediction}(\mathbf{x}_{\text{current}}) = -1 \quad (\text{i.e. } s(\mathbf{x}, N) > 0.6) \\
\text{Normal} & \text{if } \text{prediction}(\mathbf{x}_{\text{current}}) = +1
\end{cases}$$

#### Fallback Condition
If total historical samples $N < 24$ or time span $< 24\text{ hours}$, the model falls back to static thresholding: $\text{AQI}_{\text{current}} \ge 150.0$.

### Technical Explanation & Scientific Foundation
Isolation Forest isolates anomalies by randomly selecting a feature and split value. Because anomalies require fewer partition splits to isolate than normal diurnal baseline points, their tree depth $h(\mathbf{x})$ is significantly shorter.

### Practical Application in AeroTrace
Detects abnormal pollution spikes tailored to station-specific temporal patterns (e.g. distinguishing normal 8:00 AM rush hour traffic from an industrial leak).

---

## 11. Rate-of-Change (RoC) AQI Spike Detection Rule

### Codebase Location
- **File**: [`pipeline/spike_detector.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/spike_detector.py#L194-L210) (Lines 194–210)
- **Function**: `evaluate_rules()`

### Mathematical Formulation
Rule B detects rapid short-term jumps in AQI. Given current AQI $\text{AQI}_t$, previous reading $\text{AQI}_{t-\Delta t}$, and time gap $\Delta t$ (seconds):

$$\Delta \text{AQI}_{\text{observed}} = \text{AQI}_t - \text{AQI}_{t-\Delta t}$$

The dynamic rate-of-change threshold $\Delta_{\text{thresh}}(\Delta t)$ scales linearly with time gap relative to a 1-hour reference ($3600\text{ s}$), subject to a noise floor of $25.0$:

$$\Delta_{\text{thresh}}(\Delta t) = \max\left( 25.0, \; 50.0 \times \frac{\Delta t}{3600.0} \right)$$

$$\text{Rule B Triggered} = \text{True} \quad \text{if } \Delta \text{AQI}_{\text{observed}} \ge \Delta_{\text{thresh}}(\Delta t)$$

### Technical Explanation & Scientific Foundation
Prevents false positives on small polling gaps (e.g. a 5-minute gap requiring $+25$ AQI jump minimum) while correctly scaling for delayed polling intervals (e.g. a 2-hour gap requiring $+100$ AQI jump).

### Practical Application in AeroTrace
Triggers instantaneous alert payloads even when total AQI has not yet crossed the static threshold of 150, capturing early-stage catastrophic events.

---

## 12. Chemical Fingerprinting & Co-Pollutant Ratio Classification Tree

### Codebase Location
- **File**: [`pipeline/spike_detector.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/spike_detector.py#L68-L136) (Lines 68–136)
- **Functions**: `_ratio()`, `compute_chemical_fingerprint()`

### Mathematical Formulation
Two diagnostic ratios are computed from concentration readings:

$$R_{\text{PM}} = \frac{C_{\text{PM2.5}}}{C_{\text{PM10}}}, \quad R_{\text{NS}} = \frac{C_{\text{NO2}}}{C_{\text{SO2}}}$$

Classification proceeds through a strict deterministic decision tree based on exceedance factors $\text{EF}_p$:

```
                             Dominant Pollutant (Max Exceedance Factor)?
                                  /       |         |        \
                             PM10/       /PM25     /SO2       \Other
                                /       /         /            \
                       R_PM < 0.4?   EF_NO2>=1.0?  [industrial]  [mixed]
                       /       \      /        \
                     YES        NO   YES        EF_CO>=1.0?
                     /           \   /          /         \
             [crustal]          [combustion] [biomass]   [mixed]
```

1. **`crustal_dominant`**: $\arg\max(\text{EF}) = \text{PM10}$ AND $R_{\text{PM}} < 0.40$.
2. **`combustion_vehicular`**: $\arg\max(\text{EF}) = \text{PM25}$ AND $\text{EF}_{\text{NO2}} \ge 1.0$.
3. **`industrial_sulfur`**: $\arg\max(\text{EF}) = \text{SO2}$.
4. **`biomass_burning`**: $\arg\max(\text{EF}) = \text{PM25}$ AND $\text{EF}_{\text{CO}} \ge 1.0$.
5. **`mixed`**: Default fallback.

### Technical Explanation & Scientific Foundation
- Mechanical dust re-suspension produces coarse particles ($R_{\text{PM}} < 0.4$).
- Vehicle internal combustion emits high fine particulates accompanied by nitrogen dioxide ($\text{NO}_2$).
- Industrial coal combustion/smelting emits sulfur dioxide ($\text{SO}_2$).
- Open biomass/waste burning generates fine PM coupled with incomplete combustion carbon monoxide ($\text{CO}$).

---

## 13. Mixing Layer Height (MLH) Planetary Boundary Layer Model

### Codebase Location
- **File**: [`pipeline/weather_client.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/weather_client.py#L99-L128) (Lines 99–128)
- **Function**: `_estimate_mixing_layer_height()`

### Mathematical Formulation
Base boundary layer height $H_{\text{base}}$ is determined by Pasquill Class:
$H_{\text{base}}(A)=1800\,\text{m}, H_{\text{base}}(B)=1500\,\text{m}, H_{\text{base}}(C)=1200\,\text{m}, H_{\text{base}}(D)=800\,\text{m}, H_{\text{base}}(E)=300\,\text{m}, H_{\text{base}}(F)=150\,\text{m}$.

During daytime ($6 \le h < 18$), solar elevation boost $S_{\text{boost}}$ and cloud cover boost $C_{\text{boost}}$ scale $H_{\text{base}}$:

$$S_{\text{boost}} = \max\left( 0.0, \; 1.0 - \frac{|h - 12.5|}{6.0} \right)$$

$$C_{\text{boost}} = \max\left( 0.0, \; \frac{8 - \text{oktas}}{8.0} \right)$$

$$H_{\text{MLH}} = \begin{cases} 
H_{\text{base}} \times \left( 0.7 + 0.6 \cdot S_{\text{boost}} \cdot C_{\text{boost}} \right) & \text{if Daytime} \\
H_{\text{base}} \times \left( 0.5 + 0.1 \cdot \frac{\text{oktas}}{8.0} \right) & \text{if Nighttime}
\end{cases}$$

Bounded in $[50\,\text{m}, 2500\,\text{m}]$ and rounded to the nearest $10\,\text{m}$.

---

## 14. 16-Point Cardinal Wind Direction Compass Conversion

### Codebase Location
- **File**: [`pipeline/pasquill.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/pasquill.py#L107-L121) (Lines 107–121)
- **Functions**: `wind_direction_cardinal()`, `_CARDINALS_16`

### Mathematical Formulation
Translates continuous wind degree azimuth $\theta_{\text{deg}} \in [0^\circ, 360^\circ)$ to 16-point cardinal compass text:

$$\text{Index} = \left\lfloor \frac{(\theta_{\text{deg}} \bmod 360) + 11.25}{22.5} \right\rfloor \bmod 16$$

$$\text{Compass Lookup} = [\text{N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW}]$$

---

## 15. OpenWeatherMap Micro-Environmental Scaling & Consensus Averaging

### Codebase Location
- **File**: [`pipeline/cpcb_poller.py`](file:///d:/AeroTrace%20A%28Q%29I/pipeline/cpcb_poller.py#L113-L224) (Lines 113–224)
- **Functions**: `_fetch_live_owm_air()`, `fetch_station_reading()`

### Mathematical Formulation
OpenWeatherMap Air Pollution API provides $20\,\text{km}$ macro-grid telemetry. Station micro-environmental factors $K_{\text{micro}}$ scale grid values to specific urban micro-climates:

$$C_{\text{station, } p} = C_{\text{OWM, } p} \times K_{\text{micro}}(\text{station}, p)$$

#### Micro-Environmental Scaling Matrix ($K_{\text{micro}}$)

| Station Name | $\text{PM}_{2.5}$ | $\text{PM}_{10}$ | $\text{NO}_2$ | $\text{SO}_2$ | $\text{CO}$ | $\text{O}_3$ | Urban Micro-Environmental Characteristics |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Shivajinagar** | $1.45$ | $1.35$ | $1.80$ | $1.20$ | $1.40$ | $1.10$ | Commercial & heavy urban traffic junction |
| **Swargate** | $1.85$ | $1.70$ | $2.10$ | $1.40$ | $1.80$ | $1.05$ | Major MSRTC bus terminal & diesel corridor |
| **Hadapsar** | $2.20$ | $2.40$ | $1.90$ | $2.10$ | $2.00$ | $1.15$ | Industrial zone + construction corridor |
| **Kothrud** | $1.10$ | $1.05$ | $1.15$ | $1.00$ | $1.10$ | $1.00$ | Residential background station |

#### Multi-Source Consensus Averaging
When multiple live telemetry sources (WAQI, OWM Air, CPCB) respond concurrently, consensus concentration $\bar{C}_p$ is the arithmetic mean across $N$ valid sources:

$$\bar{C}_p = \frac{1}{N} \sum_{i=1}^N C_{p, i}$$
