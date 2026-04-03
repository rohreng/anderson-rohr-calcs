/**
 * SSMA Section Properties Database
 * Source: SSMA Technical Guide (2024 Edition)
 *
 * S-Sections (Studs/Joists): C-shaped members WITH stiffening lip
 * T-Sections (Tracks):       C-shaped members WITHOUT stiffening lip
 *
 * Nomenclature: {web_mils}S{flange_mils}-{thickness_mils}
 *   e.g. 600S200-43 = 6in web, 2in flange, 43 mil thickness
 *
 * Stud Properties (per row, 33 ksi and/or 50 ksi):
 *   thickness_in, Fy_ksi, area_in2, weight_lbft,
 *   Ix_in4, Sx_in3, Rx_in, Iy_in4, Ry_in,
 *   Ixe_in4, Sxe_in3, Mal_inkip, Mad_inkip, Vag_lb, Vnet_lb,
 *   Jx1000_in4, Cw_in6, Xo_in, m_in, Ro_in, beta_in, Lu_ft
 *
 * Track Properties (gross + effective at 33 & 50 ksi):
 *   thickness_in, area_in2, weight_lbft,
 *   Ix_in4, Sx_in3, Rx_in, Iy_in4, Ry_in,
 *   Ixe_33_in4, Sxe_33_in3, Ma_33_inkip, Vag_33_lb,
 *   Ixe_50_in4, Sxe_50_in3, Ma_50_inkip, Vag_50_lb (null if not available),
 *   Jx1000_in4, Cw_in6, Xo_in, m_in, Ro_in, beta_in
 *
 * USAGE EXAMPLES:
 *   // Populate a stud dropdown:
 *   SSMA.populateStudSelect("mySelectId");
 *
 *   // Get stud properties:
 *   var p = SSMA.getStudProps("600S200-43", 33);
 *   console.log(p.Ix_in4, p.Sxe_in3, p.Mal_inkip);
 *
 *   // Get track properties:
 *   var t = SSMA.getTrackProps("600T150-43");
 *   console.log(t.Ix_in4, t.Ma_33_inkip, t.Ma_50_inkip);
 */

var SSMA = (function() {
  "use strict";

  // ================================================================
  // S-SECTION (STUD) DATA  -  key: "SectionName_##ksi"
  // ================================================================
  var studData = {
    "162S125-18_33ksi": {"thickness_in": 0.0188, "Fy_ksi": 33.0, "area_in2": 0.08, "weight_lbft": 0.27, "Ix_in4": 0.038, "Sx_in3": 0.046, "Rx_in": 0.686, "Iy_in4": 0.016, "Ry_in": 0.447, "Ixe_in4": 0.034, "Sxe_in3": 0.031, "Mal_inkip": 0.61, "Mad_inkip": 0.65, "Vag_lb": 302.0, "Vnet_lb": 100.0, "Jx1000_in4": 0.009, "Cw_in6": 0.009, "Xo_in": -1.029, "m_in": 0.594, "Ro_in": 1.315, "beta_in": 0.388, "Lu_ft": 29.0},
    "162S125-27_33ksi": {"thickness_in": 0.0283, "Fy_ksi": 33.0, "area_in2": 0.12, "weight_lbft": 0.41, "Ix_in4": 0.056, "Sx_in3": 0.068, "Rx_in": 0.682, "Iy_in4": 0.023, "Ry_in": 0.443, "Ixe_in4": 0.055, "Sxe_in3": 0.053, "Mal_inkip": 1.05, "Mad_inkip": 1.14, "Vag_lb": 494.0, "Vnet_lb": 106.0, "Jx1000_in4": 0.032, "Cw_in6": 0.013, "Xo_in": -1.017, "m_in": 0.587, "Ro_in": 1.302, "beta_in": 0.39, "Lu_ft": 29.1},
    "162S125-30_33ksi": {"thickness_in": 0.0312, "Fy_ksi": 33.0, "area_in2": 0.131, "weight_lbft": 0.45, "Ix_in4": 0.061, "Sx_in3": 0.075, "Rx_in": 0.681, "Iy_in4": 0.026, "Ry_in": 0.441, "Ixe_in4": 0.06, "Sxe_in3": 0.06, "Mal_inkip": 1.19, "Mad_inkip": 1.29, "Vag_lb": 543.0, "Vnet_lb": 106.0, "Jx1000_in4": 0.043, "Cw_in6": 0.014, "Xo_in": -1.014, "m_in": 0.585, "Ro_in": 1.298, "beta_in": 0.39, "Lu_ft": 29.2},
    "162S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.145, "weight_lbft": 0.49, "Ix_in4": 0.067, "Sx_in3": 0.083, "Rx_in": 0.679, "Iy_in4": 0.028, "Ry_in": 0.44, "Ixe_in4": 0.066, "Sxe_in3": 0.069, "Mal_inkip": 1.37, "Mad_inkip": 1.48, "Vag_lb": 601.0, "Vnet_lb": 105.0, "Jx1000_in4": 0.058, "Cw_in6": 0.016, "Xo_in": -1.01, "m_in": 0.583, "Ro_in": 1.294, "beta_in": 0.391, "Lu_ft": 29.2},
    "250S125-18_33ksi": {"thickness_in": 0.0188, "Fy_ksi": 33.0, "area_in2": 0.097, "weight_lbft": 0.33, "Ix_in4": 0.099, "Sx_in3": 0.079, "Rx_in": 1.014, "Iy_in4": 0.019, "Ry_in": 0.439, "Ixe_in4": 0.089, "Sxe_in3": 0.059, "Mal_inkip": 1.17, "Mad_inkip": 1.03, "Vag_lb": 258.0, "Vnet_lb": 196.0, "Jx1000_in4": 0.011, "Cw_in6": 0.023, "Xo_in": -0.904, "m_in": 0.543, "Ro_in": 1.427, "beta_in": 0.599, "Lu_ft": 29.0},
    "250S125-27_33ksi": {"thickness_in": 0.0283, "Fy_ksi": 33.0, "area_in2": 0.144, "weight_lbft": 0.49, "Ix_in4": 0.147, "Sx_in3": 0.118, "Rx_in": 1.009, "Iy_in4": 0.027, "Ry_in": 0.434, "Ixe_in4": 0.144, "Sxe_in3": 0.097, "Mal_inkip": 1.92, "Mad_inkip": 1.83, "Vag_lb": 685.0, "Vnet_lb": 344.0, "Jx1000_in4": 0.039, "Cw_in6": 0.034, "Xo_in": -0.893, "m_in": 0.536, "Ro_in": 1.416, "beta_in": 0.602, "Lu_ft": 28.9},
    "250S125-30_33ksi": {"thickness_in": 0.0312, "Fy_ksi": 33.0, "area_in2": 0.159, "weight_lbft": 0.54, "Ix_in4": 0.161, "Sx_in3": 0.129, "Rx_in": 1.008, "Iy_in4": 0.03, "Ry_in": 0.433, "Ixe_in4": 0.159, "Sxe_in3": 0.11, "Mal_inkip": 2.17, "Mad_inkip": 2.09, "Vag_lb": 832.0, "Vnet_lb": 378.0, "Jx1000_in4": 0.052, "Cw_in6": 0.037, "Xo_in": -0.889, "m_in": 0.534, "Ro_in": 1.412, "beta_in": 0.603, "Lu_ft": 28.9},
    "250S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.176, "weight_lbft": 0.6, "Ix_in4": 0.178, "Sx_in3": 0.142, "Rx_in": 1.006, "Iy_in4": 0.033, "Ry_in": 0.431, "Ixe_in4": 0.175, "Sxe_in3": 0.125, "Mal_inkip": 2.48, "Mad_inkip": 2.41, "Vag_lb": 975.0, "Vnet_lb": 399.0, "Jx1000_in4": 0.07, "Cw_in6": 0.04, "Xo_in": -0.885, "m_in": 0.532, "Ro_in": 1.408, "beta_in": 0.605, "Lu_ft": 28.9},
    "250S125-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.227, "weight_lbft": 0.77, "Ix_in4": 0.228, "Sx_in3": 0.182, "Rx_in": 1.001, "Iy_in4": 0.041, "Ry_in": 0.426, "Ixe_in4": 0.225, "Sxe_in3": 0.177, "Mal_inkip": 3.49, "Mad_inkip": 3.43, "Vag_lb": 1265.0, "Vnet_lb": 394.0, "Jx1000_in4": 0.154, "Cw_in6": 0.05, "Xo_in": -0.873, "m_in": 0.525, "Ro_in": 1.396, "beta_in": 0.608, "Lu_ft": 28.9},
    "250S125-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.28, "weight_lbft": 0.95, "Ix_in4": 0.277, "Sx_in3": 0.222, "Rx_in": 0.994, "Iy_in4": 0.049, "Ry_in": 0.419, "Ixe_in4": 0.277, "Sxe_in3": 0.218, "Mal_inkip": 4.98, "Mad_inkip": 2.0, "Vag_lb": 5.07, "Vnet_lb": 1553.0, "Jx1000_in4": 373.0, "Cw_in6": 0.299, "Xo_in": 0.06, "m_in": -0.859, "Ro_in": 0.518, "beta_in": 1.379, "Lu_ft": 0.612},
    "250S125-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.28, "weight_lbft": 0.95, "Ix_in4": 0.277, "Sx_in3": 0.222, "Rx_in": 0.994, "Iy_in4": 0.049, "Ry_in": 0.419, "Ixe_in4": 0.274, "Sxe_in3": 0.209, "Mal_inkip": 6.25, "Mad_inkip": 6.17, "Vag_lb": 2353.0, "Vnet_lb": 565.0, "Jx1000_in4": 0.299, "Cw_in6": 0.06, "Xo_in": -0.859, "m_in": 0.518, "Ro_in": 1.379, "beta_in": 0.612, "Lu_ft": 23.3},
    "250S125-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.345, "weight_lbft": 1.18, "Ix_in4": 0.334, "Sx_in3": 0.267, "Rx_in": 0.984, "Iy_in4": 0.057, "Ry_in": 0.408, "Ixe_in4": 0.334, "Sxe_in3": 0.266, "Mal_inkip": 6.3, "Mad_inkip": 2.0, "Vag_lb": 6.32, "Vnet_lb": 1891.0, "Jx1000_in4": 342.0, "Cw_in6": 0.585, "Xo_in": 0.072, "m_in": -0.839, "Ro_in": 0.508, "beta_in": 1.356, "Lu_ft": 0.617},
    "250S125-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.345, "weight_lbft": 1.18, "Ix_in4": 0.334, "Sx_in3": 0.267, "Rx_in": 0.984, "Iy_in4": 0.057, "Ry_in": 0.408, "Ixe_in4": 0.334, "Sxe_in3": 0.262, "Mal_inkip": 7.84, "Mad_inkip": 8.01, "Vag_lb": 2866.0, "Vnet_lb": 519.0, "Jx1000_in4": 0.585, "Cw_in6": 0.072, "Xo_in": -0.839, "m_in": 0.508, "Ro_in": 1.356, "beta_in": 0.617, "Lu_ft": 23.3},
    "250S137-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.197, "weight_lbft": 0.67, "Ix_in4": 0.203, "Sx_in3": 0.163, "Rx_in": 1.015, "Iy_in4": 0.052, "Ry_in": 0.515, "Ixe_in4": 0.203, "Sxe_in3": 0.158, "Mal_inkip": 3.11, "Mad_inkip": 3.1, "Vag_lb": 975.0, "Vnet_lb": 399.0, "Jx1000_in4": 0.079, "Cw_in6": 0.076, "Xo_in": -1.141, "m_in": 0.677, "Ro_in": 1.612, "beta_in": 0.499, "Lu_ft": 35.6},
    "250S137-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.255, "weight_lbft": 0.87, "Ix_in4": 0.261, "Sx_in3": 0.208, "Rx_in": 1.01, "Iy_in4": 0.067, "Ry_in": 0.511, "Ixe_in4": 0.261, "Sxe_in3": 0.205, "Mal_inkip": 4.53, "Mad_inkip": 2.0, "Vag_lb": 4.6, "Vnet_lb": 1265.0, "Jx1000_in4": 394.0, "Cw_in6": 0.173, "Xo_in": 0.096, "m_in": -1.129, "Ro_in": 0.67, "beta_in": 1.599, "Lu_ft": 0.501},
    "250S137-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.316, "weight_lbft": 1.07, "Ix_in4": 0.318, "Sx_in3": 0.255, "Rx_in": 1.004, "Iy_in4": 0.08, "Ry_in": 0.504, "Ixe_in4": 0.318, "Sxe_in3": 0.255, "Mal_inkip": 5.76, "Mad_inkip": 2.0, "Vag_lb": 5.75, "Vnet_lb": 1553.0, "Jx1000_in4": 373.0, "Cw_in6": 0.337, "Xo_in": 0.115, "m_in": -1.115, "Ro_in": 0.663, "beta_in": 1.583, "Lu_ft": 0.504},
    "250S137-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.316, "weight_lbft": 1.07, "Ix_in4": 0.318, "Sx_in3": 0.255, "Rx_in": 1.004, "Iy_in4": 0.08, "Ry_in": 0.504, "Ixe_in4": 0.318, "Sxe_in3": 0.244, "Mal_inkip": 8.22, "Mad_inkip": 2.0, "Vag_lb": 8.34, "Vnet_lb": 2353.0, "Jx1000_in4": 565.0, "Cw_in6": 0.337, "Xo_in": 0.115, "m_in": -1.115, "Ro_in": 0.663, "beta_in": 1.583, "Lu_ft": 0.504},
    "250S137-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.39, "weight_lbft": 1.33, "Ix_in4": 0.386, "Sx_in3": 0.309, "Rx_in": 0.994, "Iy_in4": 0.095, "Ry_in": 0.495, "Ixe_in4": 0.386, "Sxe_in3": 0.309, "Mal_inkip": 7.19, "Mad_inkip": 2.0, "Vag_lb": 7.19, "Vnet_lb": 1891.0, "Jx1000_in4": 342.0, "Cw_in6": 0.661, "Xo_in": 0.138, "m_in": -1.096, "Ro_in": 0.653, "beta_in": 1.561, "Lu_ft": 0.507},
    "250S137-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.39, "weight_lbft": 1.33, "Ix_in4": 0.386, "Sx_in3": 0.309, "Rx_in": 0.994, "Iy_in4": 0.095, "Ry_in": 0.495, "Ixe_in4": 0.386, "Sxe_in3": 0.308, "Mal_inkip": 10.65, "Mad_inkip": 2.0, "Vag_lb": 10.67, "Vnet_lb": 2866.0, "Jx1000_in4": 519.0, "Cw_in6": 0.661, "Xo_in": 0.138, "m_in": -1.096, "Ro_in": 0.653, "beta_in": 1.561, "Lu_ft": 0.507},
    "250S137-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.533, "weight_lbft": 1.81, "Ix_in4": 0.506, "Sx_in3": 0.405, "Rx_in": 0.975, "Iy_in4": 0.12, "Ry_in": 0.475, "Ixe_in4": 0.506, "Sxe_in3": 0.405, "Mal_inkip": 10.01, "Mad_inkip": 10.01, "Vag_lb": 2506.0, "Vnet_lb": 283.0, "Jx1000_in4": 1.839, "Cw_in6": 0.176, "Xo_in": -1.057, "m_in": 0.633, "Ro_in": 1.514, "beta_in": 0.513, "Lu_ft": 33.1},
    "250S137-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.533, "weight_lbft": 1.81, "Ix_in4": 0.506, "Sx_in3": 0.405, "Rx_in": 0.975, "Iy_in4": 0.12, "Ry_in": 0.475, "Ixe_in4": 0.506, "Sxe_in3": 0.405, "Mal_inkip": 14.75, "Mad_inkip": 14.75, "Vag_lb": 3798.0, "Vnet_lb": 429.0, "Jx1000_in4": 1.839, "Cw_in6": 0.176, "Xo_in": -1.057, "m_in": 0.633, "Ro_in": 1.514, "beta_in": 0.513, "Lu_ft": 26.5},
    "250S162-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.223, "weight_lbft": 0.76, "Ix_in4": 0.235, "Sx_in3": 0.188, "Rx_in": 1.027, "Iy_in4": 0.087, "Ry_in": 0.624, "Ixe_in4": 0.235, "Sxe_in3": 0.18, "Mal_inkip": 3.55, "Mad_inkip": 3.56, "Vag_lb": 975.0, "Vnet_lb": 399.0, "Jx1000_in4": 0.089, "Cw_in6": 0.146, "Xo_in": -1.47, "m_in": 0.859, "Ro_in": 1.898, "beta_in": 0.401, "Lu_ft": 44.1},
    "250S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.289, "weight_lbft": 0.98, "Ix_in4": 0.302, "Sx_in3": 0.242, "Rx_in": 1.022, "Iy_in4": 0.111, "Ry_in": 0.62, "Ixe_in4": 0.302, "Sxe_in3": 0.24, "Mal_inkip": 5.22, "Mad_inkip": 2.0, "Vag_lb": 5.25, "Vnet_lb": 1265.0, "Jx1000_in4": 394.0, "Cw_in6": 0.196, "Xo_in": 0.184, "m_in": -1.457, "Ro_in": 0.852, "beta_in": 1.885, "Lu_ft": 0.402},
    "250S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.358, "weight_lbft": 1.22, "Ix_in4": 0.37, "Sx_in3": 0.296, "Rx_in": 1.016, "Iy_in4": 0.135, "Ry_in": 0.613, "Ixe_in4": 0.37, "Sxe_in3": 0.296, "Mal_inkip": 6.57, "Mad_inkip": 2.0, "Vag_lb": 6.57, "Vnet_lb": 1553.0, "Jx1000_in4": 373.0, "Cw_in6": 0.383, "Xo_in": 0.223, "m_in": -1.443, "Ro_in": 0.845, "beta_in": 1.868, "Lu_ft": 0.403},
    "250S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.358, "weight_lbft": 1.22, "Ix_in4": 0.37, "Sx_in3": 0.296, "Rx_in": 1.016, "Iy_in4": 0.135, "Ry_in": 0.613, "Ixe_in4": 0.37, "Sxe_in3": 0.284, "Mal_inkip": 9.42, "Mad_inkip": 2.0, "Vag_lb": 9.46, "Vnet_lb": 2353.0, "Jx1000_in4": 565.0, "Cw_in6": 0.383, "Xo_in": 0.223, "m_in": -1.443, "Ro_in": 0.845, "beta_in": 1.868, "Lu_ft": 0.403},
    "250S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.443, "weight_lbft": 1.51, "Ix_in4": 0.45, "Sx_in3": 0.36, "Rx_in": 1.007, "Iy_in4": 0.162, "Ry_in": 0.605, "Ixe_in4": 0.45, "Sxe_in3": 0.36, "Mal_inkip": 8.21, "Mad_inkip": 2.0, "Vag_lb": 8.21, "Vnet_lb": 1891.0, "Jx1000_in4": 342.0, "Cw_in6": 0.752, "Xo_in": 0.268, "m_in": -1.424, "Ro_in": 0.835, "beta_in": 1.846, "Lu_ft": 0.405},
    "250S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.443, "weight_lbft": 1.51, "Ix_in4": 0.45, "Sx_in3": 0.36, "Rx_in": 1.007, "Iy_in4": 0.162, "Ry_in": 0.605, "Ixe_in4": 0.45, "Sxe_in3": 0.357, "Mal_inkip": 12.11, "Mad_inkip": 2.0, "Vag_lb": 12.21, "Vnet_lb": 2866.0, "Jx1000_in4": 519.0, "Cw_in6": 0.752, "Xo_in": 0.268, "m_in": -1.424, "Ro_in": 0.835, "beta_in": 1.846, "Lu_ft": 0.405},
    "250S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.61, "weight_lbft": 2.07, "Ix_in4": 0.596, "Sx_in3": 0.477, "Rx_in": 0.989, "Iy_in4": 0.209, "Ry_in": 0.586, "Ixe_in4": 0.596, "Sxe_in3": 0.477, "Mal_inkip": 11.45, "Mad_inkip": 11.45, "Vag_lb": 2506.0, "Vnet_lb": 283.0, "Jx1000_in4": 2.102, "Cw_in6": 0.346, "Xo_in": -1.386, "m_in": 0.815, "Ro_in": 1.801, "beta_in": 0.408, "Lu_ft": 41.9},
    "250S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.61, "weight_lbft": 2.07, "Ix_in4": 0.596, "Sx_in3": 0.477, "Rx_in": 0.989, "Iy_in4": 0.209, "Ry_in": 0.586, "Ixe_in4": 0.596, "Sxe_in3": 0.477, "Mal_inkip": 16.93, "Mad_inkip": 16.93, "Vag_lb": 3798.0, "Vnet_lb": 429.0, "Jx1000_in4": 2.102, "Cw_in6": 0.346, "Xo_in": -1.386, "m_in": 0.815, "Ro_in": 1.801, "beta_in": 0.408, "Lu_ft": 33.5},
    "250S200-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.258, "weight_lbft": 0.88, "Ix_in4": 0.279, "Sx_in3": 0.223, "Rx_in": 1.04, "Iy_in4": 0.154, "Ry_in": 0.773, "Ixe_in4": 0.276, "Sxe_in3": 0.197, "Mal_inkip": 3.9, "Mad_inkip": 4.09, "Vag_lb": 975.0, "Vnet_lb": 399.0, "Jx1000_in4": 0.103, "Cw_in6": 0.302, "Xo_in": -1.926, "m_in": 1.108, "Ro_in": 2.321, "beta_in": 0.312, "Lu_ft": 56.0},
    "250S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.334, "weight_lbft": 1.14, "Ix_in4": 0.358, "Sx_in3": 0.287, "Rx_in": 1.036, "Iy_in4": 0.198, "Ry_in": 0.769, "Ixe_in4": 0.358, "Sxe_in3": 0.278, "Mal_inkip": 5.49, "Mad_inkip": 5.66, "Vag_lb": 1265.0, "Vnet_lb": 394.0, "Jx1000_in4": 0.227, "Cw_in6": 0.382, "Xo_in": -1.914, "m_in": 1.101, "Ro_in": 2.308, "beta_in": 0.312, "Lu_ft": 56.1},
    "250S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.415, "weight_lbft": 1.41, "Ix_in4": 0.44, "Sx_in3": 0.352, "Rx_in": 1.03, "Iy_in4": 0.241, "Ry_in": 0.763, "Ixe_in4": 0.44, "Sxe_in3": 0.352, "Mal_inkip": 7.65, "Mad_inkip": 7.65, "Vag_lb": 1553.0, "Vnet_lb": 373.0, "Jx1000_in4": 0.443, "Cw_in6": 0.464, "Xo_in": -1.899, "m_in": 1.093, "Ro_in": 2.291, "beta_in": 0.313, "Lu_ft": 53.7},
    "250S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.415, "weight_lbft": 1.41, "Ix_in4": 0.44, "Sx_in3": 0.352, "Rx_in": 1.03, "Iy_in4": 0.241, "Ry_in": 0.763, "Ixe_in4": 0.44, "Sxe_in3": 0.321, "Mal_inkip": 9.6, "Mad_inkip": 10.11, "Vag_lb": 2353.0, "Vnet_lb": 565.0, "Jx1000_in4": 0.443, "Cw_in6": 0.464, "Xo_in": -1.899, "m_in": 1.093, "Ro_in": 2.291, "beta_in": 0.313, "Lu_ft": 45.5},
    "250S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.515, "weight_lbft": 1.75, "Ix_in4": 0.537, "Sx_in3": 0.43, "Rx_in": 1.022, "Iy_in4": 0.293, "Ry_in": 0.754, "Ixe_in4": 0.537, "Sxe_in3": 0.43, "Mal_inkip": 9.57, "Mad_inkip": 9.57, "Vag_lb": 1891.0, "Vnet_lb": 342.0, "Jx1000_in4": 0.872, "Cw_in6": 0.561, "Xo_in": -1.881, "m_in": 1.084, "Ro_in": 2.27, "beta_in": 0.313, "Lu_ft": 53.7},
    "250S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.515, "weight_lbft": 1.75, "Ix_in4": 0.537, "Sx_in3": 0.43, "Rx_in": 1.022, "Iy_in4": 0.293, "Ry_in": 0.754, "Ixe_in4": 0.537, "Sxe_in3": 0.417, "Mal_inkip": 13.84, "Mad_inkip": 14.27, "Vag_lb": 2866.0, "Vnet_lb": 519.0, "Jx1000_in4": 0.872, "Cw_in6": 0.561, "Xo_in": -1.881, "m_in": 1.084, "Ro_in": 2.27, "beta_in": 0.313, "Lu_ft": 43.4},
    "250S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.711, "weight_lbft": 2.42, "Ix_in4": 0.718, "Sx_in3": 0.575, "Rx_in": 1.005, "Iy_in4": 0.386, "Ry_in": 0.736, "Ixe_in4": 0.718, "Sxe_in3": 0.575, "Mal_inkip": 13.36, "Mad_inkip": 13.36, "Vag_lb": 2506.0, "Vnet_lb": 283.0, "Jx1000_in4": 2.452, "Cw_in6": 0.735, "Xo_in": -1.843, "m_in": 1.063, "Ro_in": 2.224, "beta_in": 0.314, "Lu_ft": 54.2},
    "250S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.711, "weight_lbft": 2.42, "Ix_in4": 0.718, "Sx_in3": 0.575, "Rx_in": 1.005, "Iy_in4": 0.386, "Ry_in": 0.736, "Ixe_in4": 0.718, "Sxe_in3": 0.575, "Mal_inkip": 19.82, "Mad_inkip": 19.82, "Vag_lb": 3798.0, "Vnet_lb": 429.0, "Jx1000_in4": 2.452, "Cw_in6": 0.735, "Xo_in": -1.843, "m_in": 1.063, "Ro_in": 2.224, "beta_in": 0.314, "Lu_ft": 43.4},
    "250S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.379, "weight_lbft": 1.29, "Ix_in4": 0.426, "Sx_in3": 0.341, "Rx_in": 1.06, "Iy_in4": 0.336, "Ry_in": 0.941, "Ixe_in4": 0.426, "Sxe_in3": 0.297, "Mal_inkip": 5.87, "Mad_inkip": 6.24, "Vag_lb": 1265.0, "Vnet_lb": 394.0, "Jx1000_in4": 0.257, "Cw_in6": 0.638, "Xo_in": -2.404, "m_in": 1.359, "Ro_in": 2.791, "beta_in": 0.258, "Lu_ft": 66.8},
    "250S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.471, "weight_lbft": 1.6, "Ix_in4": 0.524, "Sx_in3": 0.419, "Rx_in": 1.055, "Iy_in4": 0.412, "Ry_in": 0.935, "Ixe_in4": 0.524, "Sxe_in3": 0.379, "Mal_inkip": 7.49, "Mad_inkip": 8.22, "Vag_lb": 1553.0, "Vnet_lb": 373.0, "Jx1000_in4": 0.503, "Cw_in6": 0.778, "Xo_in": -2.389, "m_in": 1.351, "Ro_in": 2.774, "beta_in": 0.258, "Lu_ft": 67.3},
    "250S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.471, "weight_lbft": 1.6, "Ix_in4": 0.524, "Sx_in3": 0.419, "Rx_in": 1.055, "Iy_in4": 0.412, "Ry_in": 0.935, "Ixe_in4": 0.521, "Sxe_in3": 0.341, "Mal_inkip": 10.22, "Mad_inkip": 11.02, "Vag_lb": 2353.0, "Vnet_lb": 565.0, "Jx1000_in4": 0.503, "Cw_in6": 0.778, "Xo_in": -2.389, "m_in": 1.351, "Ro_in": 2.774, "beta_in": 0.258, "Lu_ft": 54.1},
    "250S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.586, "weight_lbft": 1.99, "Ix_in4": 0.643, "Sx_in3": 0.514, "Rx_in": 1.047, "Iy_in4": 0.503, "Ry_in": 0.926, "Ixe_in4": 0.643, "Sxe_in3": 0.495, "Mal_inkip": 10.79, "Mad_inkip": 11.19, "Vag_lb": 1891.0, "Vnet_lb": 342.0, "Jx1000_in4": 0.993, "Cw_in6": 0.944, "Xo_in": -2.371, "m_in": 1.341, "Ro_in": 2.752, "beta_in": 0.258, "Lu_ft": 64.6},
    "250S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.586, "weight_lbft": 1.99, "Ix_in4": 0.643, "Sx_in3": 0.514, "Rx_in": 1.047, "Iy_in4": 0.503, "Ry_in": 0.926, "Ixe_in4": 0.643, "Sxe_in3": 0.446, "Mal_inkip": 13.35, "Mad_inkip": 14.59, "Vag_lb": 2866.0, "Vnet_lb": 519.0, "Jx1000_in4": 0.993, "Cw_in6": 0.944, "Xo_in": -2.371, "m_in": 1.341, "Ro_in": 2.752, "beta_in": 0.258, "Lu_ft": 54.5},
    "250S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.813, "weight_lbft": 2.77, "Ix_in4": 0.864, "Sx_in3": 0.692, "Rx_in": 1.031, "Iy_in4": 0.67, "Ry_in": 0.908, "Ixe_in4": 0.864, "Sxe_in3": 0.69, "Mal_inkip": 15.6, "Mad_inkip": 15.62, "Vag_lb": 2506.0, "Vnet_lb": 283.0, "Jx1000_in4": 2.803, "Cw_in6": 1.245, "Xo_in": -2.332, "m_in": 1.32, "Ro_in": 2.707, "beta_in": 0.258, "Lu_ft": 65.6},
    "250S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.813, "weight_lbft": 2.77, "Ix_in4": 0.864, "Sx_in3": 0.692, "Rx_in": 1.031, "Iy_in4": 0.67, "Ry_in": 0.908, "Ixe_in4": 0.864, "Sxe_in3": 0.663, "Mal_inkip": 22.31, "Mad_inkip": 23.26, "Vag_lb": 3798.0, "Vnet_lb": 429.0, "Jx1000_in4": 2.803, "Cw_in6": 1.245, "Xo_in": -2.332, "m_in": 1.32, "Ro_in": 2.707, "beta_in": 0.258, "Lu_ft": 52.4},
    "350S125-18_33ksi": {"thickness_in": 0.0188, "Fy_ksi": 33.0, "area_in2": 0.115, "weight_lbft": 0.39, "Ix_in4": 0.215, "Sx_in3": 0.123, "Rx_in": 1.366, "Iy_in4": 0.021, "Ry_in": 0.423, "Ixe_in4": 0.203, "Sxe_in3": 0.072, "Mal_inkip": 1.42, "Mad_inkip": 1.47, "Vag_lb": 180.0, "Vnet_lb": 159.0, "Jx1000_in4": 0.014, "Cw_in6": 0.05, "Xo_in": -0.797, "m_in": 0.495, "Ro_in": 1.637, "beta_in": 0.763, "Lu_ft": 28.8},
    "350S125-27_33ksi": {"thickness_in": 0.0283, "Fy_ksi": 33.0, "area_in2": 0.173, "weight_lbft": 0.59, "Ix_in4": 0.32, "Sx_in3": 0.183, "Rx_in": 1.361, "Iy_in4": 0.03, "Ry_in": 0.418, "Ixe_in4": 0.315, "Sxe_in3": 0.13, "Mal_inkip": 2.57, "Mad_inkip": 2.65, "Vag_lb": 614.0, "Vnet_lb": 359.0, "Jx1000_in4": 0.046, "Cw_in6": 0.072, "Xo_in": -0.787, "m_in": 0.489, "Ro_in": 1.627, "beta_in": 0.766, "Lu_ft": 28.7},
    "350S125-30_33ksi": {"thickness_in": 0.0312, "Fy_ksi": 33.0, "area_in2": 0.19, "weight_lbft": 0.65, "Ix_in4": 0.351, "Sx_in3": 0.201, "Rx_in": 1.359, "Iy_in4": 0.033, "Ry_in": 0.417, "Ixe_in4": 0.346, "Sxe_in3": 0.15, "Mal_inkip": 2.96, "Mad_inkip": 3.04, "Vag_lb": 824.0, "Vnet_lb": 436.0, "Jx1000_in4": 0.062, "Cw_in6": 0.079, "Xo_in": -0.784, "m_in": 0.487, "Ro_in": 1.624, "beta_in": 0.767, "Lu_ft": 28.6},
    "350S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.21, "weight_lbft": 0.72, "Ix_in4": 0.387, "Sx_in3": 0.221, "Rx_in": 1.358, "Iy_in4": 0.036, "Ry_in": 0.415, "Ixe_in4": 0.382, "Sxe_in3": 0.175, "Mal_inkip": 3.45, "Mad_inkip": 3.53, "Vag_lb": 1024.0, "Vnet_lb": 487.0, "Jx1000_in4": 0.084, "Cw_in6": 0.087, "Xo_in": -0.78, "m_in": 0.485, "Ro_in": 1.62, "beta_in": 0.768, "Lu_ft": 28.6},
    "350S125-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.272, "weight_lbft": 0.93, "Ix_in4": 0.498, "Sx_in3": 0.284, "Rx_in": 1.352, "Iy_in4": 0.046, "Ry_in": 0.41, "Ixe_in4": 0.495, "Sxe_in3": 0.258, "Mal_inkip": 5.1, "Mad_inkip": 5.11, "Vag_lb": 1739.0, "Vnet_lb": 631.0, "Jx1000_in4": 0.184, "Cw_in6": 0.109, "Xo_in": -0.769, "m_in": 0.479, "Ro_in": 1.609, "beta_in": 0.771, "Lu_ft": 28.4},
    "350S125-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.337, "weight_lbft": 1.15, "Ix_in4": 0.608, "Sx_in3": 0.348, "Rx_in": 1.344, "Iy_in4": 0.055, "Ry_in": 0.402, "Ixe_in4": 0.608, "Sxe_in3": 0.328, "Mal_inkip": 6.49, "Mad_inkip": 6.87, "Vag_lb": 2253.0, "Vnet_lb": 633.0, "Jx1000_in4": 0.36, "Cw_in6": 0.131, "Xo_in": -0.755, "m_in": 0.471, "Ro_in": 1.593, "beta_in": 0.775, "Lu_ft": 28.4},
    "350S125-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.337, "weight_lbft": 1.15, "Ix_in4": 0.608, "Sx_in3": 0.348, "Rx_in": 1.344, "Iy_in4": 0.055, "Ry_in": 0.402, "Ixe_in4": 0.604, "Sxe_in3": 0.308, "Mal_inkip": 9.22, "Mad_inkip": 9.25, "Vag_lb": 3372.0, "Vnet_lb": 947.0, "Jx1000_in4": 0.36, "Cw_in6": 0.131, "Xo_in": -0.755, "m_in": 0.471, "Ro_in": 1.593, "beta_in": 0.775, "Lu_ft": 22.9},
    "350S125-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.417, "weight_lbft": 1.42, "Ix_in4": 0.739, "Sx_in3": 0.422, "Rx_in": 1.332, "Iy_in4": 0.064, "Ry_in": 0.391, "Ixe_in4": 0.737, "Sxe_in3": 0.409, "Mal_inkip": 9.67, "Mad_inkip": 2.0, "Vag_lb": 9.98, "Vnet_lb": 2774.0, "Jx1000_in4": 592.0, "Cw_in6": 0.706, "Xo_in": 0.156, "m_in": -0.737, "Ro_in": 0.462, "beta_in": 1.571, "Lu_ft": 0.78},
    "350S125-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.417, "weight_lbft": 1.42, "Ix_in4": 0.739, "Sx_in3": 0.422, "Rx_in": 1.332, "Iy_in4": 0.064, "Ry_in": 0.391, "Ixe_in4": 0.737, "Sxe_in3": 0.4, "Mal_inkip": 11.97, "Mad_inkip": 12.54, "Vag_lb": 4202.0, "Vnet_lb": 897.0, "Jx1000_in4": 0.706, "Cw_in6": 0.156, "Xo_in": -0.737, "m_in": 0.462, "Ro_in": 1.571, "beta_in": 0.78, "Lu_ft": 22.8},
    "350S137-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.232, "weight_lbft": 0.79, "Ix_in4": 0.441, "Sx_in3": 0.252, "Rx_in": 1.38, "Iy_in4": 0.059, "Ry_in": 0.503, "Ixe_in4": 0.441, "Sxe_in3": 0.223, "Mal_inkip": 4.41, "Mad_inkip": 4.54, "Vag_lb": 1024.0, "Vnet_lb": 487.0, "Jx1000_in4": 0.093, "Cw_in6": 0.153, "Xo_in": -1.016, "m_in": 0.621, "Ro_in": 1.786, "beta_in": 0.676, "Lu_ft": 34.8},
    "350S137-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.3, "weight_lbft": 1.02, "Ix_in4": 0.568, "Sx_in3": 0.324, "Rx_in": 1.375, "Iy_in4": 0.075, "Ry_in": 0.498, "Ixe_in4": 0.568, "Sxe_in3": 0.307, "Mal_inkip": 6.07, "Mad_inkip": 6.38, "Vag_lb": 1739.0, "Vnet_lb": 631.0, "Jx1000_in4": 0.204, "Cw_in6": 0.193, "Xo_in": -1.005, "m_in": 0.615, "Ro_in": 1.774, "beta_in": 0.679, "Lu_ft": 34.7},
    "350S137-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.372, "weight_lbft": 1.27, "Ix_in4": 0.696, "Sx_in3": 0.398, "Rx_in": 1.367, "Iy_in4": 0.09, "Ry_in": 0.492, "Ixe_in4": 0.696, "Sxe_in3": 0.385, "Mal_inkip": 7.61, "Mad_inkip": 7.86, "Vag_lb": 2253.0, "Vnet_lb": 633.0, "Jx1000_in4": 0.398, "Cw_in6": 0.233, "Xo_in": -0.991, "m_in": 0.607, "Ro_in": 1.759, "beta_in": 0.683, "Lu_ft": 34.7},
    "350S137-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.372, "weight_lbft": 1.27, "Ix_in4": 0.696, "Sx_in3": 0.398, "Rx_in": 1.367, "Iy_in4": 0.09, "Ry_in": 0.492, "Ixe_in4": 0.696, "Sxe_in3": 0.366, "Mal_inkip": 10.95, "Mad_inkip": 11.42, "Vag_lb": 3372.0, "Vnet_lb": 947.0, "Jx1000_in4": 0.398, "Cw_in6": 0.233, "Xo_in": -0.991, "m_in": 0.607, "Ro_in": 1.759, "beta_in": 0.683, "Lu_ft": 28.0},
    "350S137-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.461, "weight_lbft": 1.57, "Ix_in4": 0.849, "Sx_in3": 0.485, "Rx_in": 1.357, "Iy_in4": 0.107, "Ry_in": 0.482, "Ixe_in4": 0.849, "Sxe_in3": 0.474, "Mal_inkip": 11.04, "Mad_inkip": 11.31, "Vag_lb": 2774.0, "Vnet_lb": 592.0, "Jx1000_in4": 0.782, "Cw_in6": 0.28, "Xo_in": -0.973, "m_in": 0.598, "Ro_in": 1.738, "beta_in": 0.687, "Lu_ft": 31.8},
    "350S137-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.461, "weight_lbft": 1.57, "Ix_in4": 0.849, "Sx_in3": 0.485, "Rx_in": 1.357, "Iy_in4": 0.107, "Ry_in": 0.482, "Ixe_in4": 0.849, "Sxe_in3": 0.472, "Mal_inkip": 14.12, "Mad_inkip": 14.53, "Vag_lb": 4202.0, "Vnet_lb": 897.0, "Jx1000_in4": 0.782, "Cw_in6": 0.28, "Xo_in": -0.973, "m_in": 0.598, "Ro_in": 1.738, "beta_in": 0.687, "Lu_ft": 27.9},
    "350S137-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.635, "weight_lbft": 2.16, "Ix_in4": 1.13, "Sx_in3": 0.646, "Rx_in": 1.334, "Iy_in4": 0.136, "Ry_in": 0.462, "Ixe_in4": 1.13, "Sxe_in3": 0.629, "Mal_inkip": 15.54, "Mad_inkip": 15.95, "Vag_lb": 3765.0, "Vnet_lb": 511.0, "Jx1000_in4": 2.189, "Cw_in6": 0.361, "Xo_in": -0.935, "m_in": 0.579, "Ro_in": 1.693, "beta_in": 0.695, "Lu_ft": 31.1},
    "350S137-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.635, "weight_lbft": 2.16, "Ix_in4": 1.13, "Sx_in3": 0.646, "Rx_in": 1.334, "Iy_in4": 0.136, "Ry_in": 0.462, "Ixe_in4": 1.13, "Sxe_in3": 0.629, "Mal_inkip": 22.9, "Mad_inkip": 23.49, "Vag_lb": 5704.0, "Vnet_lb": 775.0, "Jx1000_in4": 2.189, "Cw_in6": 0.361, "Xo_in": -0.935, "m_in": 0.579, "Ro_in": 1.693, "beta_in": 0.695, "Lu_ft": 25.2},
    "350S162-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.258, "weight_lbft": 0.88, "Ix_in4": 0.508, "Sx_in3": 0.29, "Rx_in": 1.404, "Iy_in4": 0.098, "Ry_in": 0.617, "Ixe_in4": 0.508, "Sxe_in3": 0.257, "Mal_inkip": 5.08, "Mad_inkip": 5.22, "Vag_lb": 1024.0, "Vnet_lb": 487.0, "Jx1000_in4": 0.103, "Cw_in6": 0.277, "Xo_in": -1.324, "m_in": 0.796, "Ro_in": 2.026, "beta_in": 0.573, "Lu_ft": 42.7},
    "350S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.334, "weight_lbft": 1.14, "Ix_in4": 0.654, "Sx_in3": 0.374, "Rx_in": 1.4, "Iy_in4": 0.125, "Ry_in": 0.612, "Ixe_in4": 0.654, "Sxe_in3": 0.357, "Mal_inkip": 7.05, "Mad_inkip": 7.31, "Vag_lb": 1739.0, "Vnet_lb": 631.0, "Jx1000_in4": 0.227, "Cw_in6": 0.35, "Xo_in": -1.312, "m_in": 0.789, "Ro_in": 2.014, "beta_in": 0.575, "Lu_ft": 42.6},
    "350S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.415, "weight_lbft": 1.41, "Ix_in4": 0.804, "Sx_in3": 0.46, "Rx_in": 1.392, "Iy_in4": 0.152, "Ry_in": 0.606, "Ixe_in4": 0.804, "Sxe_in3": 0.447, "Mal_inkip": 8.83, "Mad_inkip": 9.08, "Vag_lb": 2253.0, "Vnet_lb": 633.0, "Jx1000_in4": 0.443, "Cw_in6": 0.426, "Xo_in": -1.298, "m_in": 0.782, "Ro_in": 1.998, "beta_in": 0.578, "Lu_ft": 42.7},
    "350S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.415, "weight_lbft": 1.41, "Ix_in4": 0.804, "Sx_in3": 0.46, "Rx_in": 1.392, "Iy_in4": 0.152, "Ry_in": 0.606, "Ixe_in4": 0.804, "Sxe_in3": 0.426, "Mal_inkip": 12.74, "Mad_inkip": 13.05, "Vag_lb": 3372.0, "Vnet_lb": 947.0, "Jx1000_in4": 0.443, "Cw_in6": 0.426, "Xo_in": -1.298, "m_in": 0.782, "Ro_in": 1.998, "beta_in": 0.578, "Lu_ft": 34.5},
    "350S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.515, "weight_lbft": 1.75, "Ix_in4": 0.985, "Sx_in3": 0.563, "Rx_in": 1.383, "Iy_in4": 0.184, "Ry_in": 0.597, "Ixe_in4": 0.985, "Sxe_in3": 0.551, "Mal_inkip": 12.56, "Mad_inkip": 2.0, "Vag_lb": 12.83, "Vnet_lb": 2774.0, "Jx1000_in4": 592.0, "Cw_in6": 0.872, "Xo_in": 0.514, "m_in": -1.28, "Ro_in": 0.772, "beta_in": 1.977, "Lu_ft": 0.581},
    "350S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.515, "weight_lbft": 1.75, "Ix_in4": 0.985, "Sx_in3": 0.563, "Rx_in": 1.383, "Iy_in4": 0.184, "Ry_in": 0.597, "Ixe_in4": 0.985, "Sxe_in3": 0.549, "Mal_inkip": 16.44, "Mad_inkip": 16.84, "Vag_lb": 4202.0, "Vnet_lb": 897.0, "Jx1000_in4": 0.872, "Cw_in6": 0.514, "Xo_in": -1.28, "m_in": 0.772, "Ro_in": 1.977, "beta_in": 0.581, "Lu_ft": 34.5},
    "350S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.711, "weight_lbft": 2.42, "Ix_in4": 1.32, "Sx_in3": 0.754, "Rx_in": 1.362, "Iy_in4": 0.238, "Ry_in": 0.578, "Ixe_in4": 1.32, "Sxe_in3": 0.738, "Mal_inkip": 17.71, "Mad_inkip": 18.11, "Vag_lb": 3765.0, "Vnet_lb": 511.0, "Jx1000_in4": 2.452, "Cw_in6": 0.672, "Xo_in": -1.242, "m_in": 0.752, "Ro_in": 1.932, "beta_in": 0.587, "Lu_ft": 39.1},
    "350S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.711, "weight_lbft": 2.42, "Ix_in4": 1.32, "Sx_in3": 0.754, "Rx_in": 1.362, "Iy_in4": 0.238, "Ry_in": 0.578, "Ixe_in4": 1.32, "Sxe_in3": 0.738, "Mal_inkip": 26.18, "Mad_inkip": 26.76, "Vag_lb": 5704.0, "Vnet_lb": 775.0, "Jx1000_in4": 2.452, "Cw_in6": 0.672, "Xo_in": -1.242, "m_in": 0.752, "Ro_in": 1.932, "beta_in": 0.587, "Lu_ft": 31.7},
    "350S200-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.292, "weight_lbft": 0.99, "Ix_in4": 0.598, "Sx_in3": 0.342, "Rx_in": 1.431, "Iy_in4": 0.175, "Ry_in": 0.773, "Ixe_in4": 0.597, "Sxe_in3": 0.283, "Mal_inkip": 5.59, "Mad_inkip": 5.95, "Vag_lb": 1024.0, "Vnet_lb": 487.0, "Jx1000_in4": 0.117, "Cw_in6": 0.541, "Xo_in": -1.76, "m_in": 1.039, "Ro_in": 2.396, "beta_in": 0.461, "Lu_ft": 53.7},
    "350S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.379, "weight_lbft": 1.29, "Ix_in4": 0.771, "Sx_in3": 0.441, "Rx_in": 1.426, "Iy_in4": 0.224, "Ry_in": 0.768, "Ixe_in4": 0.771, "Sxe_in3": 0.41, "Mal_inkip": 8.09, "Mad_inkip": 8.36, "Vag_lb": 1739.0, "Vnet_lb": 631.0, "Jx1000_in4": 0.257, "Cw_in6": 0.687, "Xo_in": -1.748, "m_in": 1.032, "Ro_in": 2.383, "beta_in": 0.462, "Lu_ft": 53.7},
    "350S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.471, "weight_lbft": 1.6, "Ix_in4": 0.95, "Sx_in3": 0.543, "Rx_in": 1.42, "Iy_in4": 0.274, "Ry_in": 0.762, "Ixe_in4": 0.95, "Sxe_in3": 0.53, "Mal_inkip": 10.47, "Mad_inkip": 10.73, "Vag_lb": 2253.0, "Vnet_lb": 633.0, "Jx1000_in4": 0.503, "Cw_in6": 0.838, "Xo_in": -1.733, "m_in": 1.024, "Ro_in": 2.367, "beta_in": 0.464, "Lu_ft": 53.8},
    "350S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.471, "weight_lbft": 1.6, "Ix_in4": 0.95, "Sx_in3": 0.543, "Rx_in": 1.42, "Iy_in4": 0.274, "Ry_in": 0.762, "Ixe_in4": 0.95, "Sxe_in3": 0.47, "Mal_inkip": 14.07, "Mad_inkip": 14.86, "Vag_lb": 3372.0, "Vnet_lb": 947.0, "Jx1000_in4": 0.503, "Cw_in6": 0.838, "Xo_in": -1.733, "m_in": 1.024, "Ro_in": 2.367, "beta_in": 0.464, "Lu_ft": 43.5},
    "350S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.586, "weight_lbft": 1.99, "Ix_in4": 1.167, "Sx_in3": 0.667, "Rx_in": 1.411, "Iy_in4": 0.333, "Ry_in": 0.754, "Ixe_in4": 1.167, "Sxe_in3": 0.655, "Mal_inkip": 14.58, "Mad_inkip": 14.84, "Vag_lb": 2774.0, "Vnet_lb": 592.0, "Jx1000_in4": 0.993, "Cw_in6": 1.018, "Xo_in": -1.715, "m_in": 1.014, "Ro_in": 2.345, "beta_in": 0.465, "Lu_ft": 50.8},
    "350S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.586, "weight_lbft": 1.99, "Ix_in4": 1.167, "Sx_in3": 0.667, "Rx_in": 1.411, "Iy_in4": 0.333, "Ry_in": 0.754, "Ixe_in4": 1.167, "Sxe_in3": 0.638, "Mal_inkip": 19.1, "Mad_inkip": 19.68, "Vag_lb": 4202.0, "Vnet_lb": 897.0, "Jx1000_in4": 0.993, "Cw_in6": 1.018, "Xo_in": -1.715, "m_in": 1.014, "Ro_in": 2.345, "beta_in": 0.465, "Lu_ft": 43.5},
    "350S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.813, "weight_lbft": 2.77, "Ix_in4": 1.576, "Sx_in3": 0.901, "Rx_in": 1.393, "Iy_in4": 0.44, "Ry_in": 0.736, "Ixe_in4": 1.576, "Sxe_in3": 0.884, "Mal_inkip": 20.57, "Mad_inkip": 20.95, "Vag_lb": 3765.0, "Vnet_lb": 511.0, "Jx1000_in4": 2.803, "Cw_in6": 1.347, "Xo_in": -1.676, "m_in": 0.994, "Ro_in": 2.3, "beta_in": 0.469, "Lu_ft": 50.3},
    "350S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.813, "weight_lbft": 2.77, "Ix_in4": 1.576, "Sx_in3": 0.901, "Rx_in": 1.393, "Iy_in4": 0.44, "Ry_in": 0.736, "Ixe_in4": 1.576, "Sxe_in3": 0.884, "Mal_inkip": 30.51, "Mad_inkip": 31.08, "Vag_lb": 5704.0, "Vnet_lb": 775.0, "Jx1000_in4": 2.803, "Cw_in6": 1.347, "Xo_in": -1.676, "m_in": 0.994, "Ro_in": 2.3, "beta_in": 0.469, "Lu_ft": 40.7},
    "350S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.424, "weight_lbft": 1.44, "Ix_in4": 0.906, "Sx_in3": 0.518, "Rx_in": 1.461, "Iy_in4": 0.38, "Ry_in": 0.946, "Ixe_in4": 0.906, "Sxe_in3": 0.431, "Mal_inkip": 8.52, "Mad_inkip": 9.0, "Vag_lb": 1739.0, "Vnet_lb": 631.0, "Jx1000_in4": 0.288, "Cw_in6": 1.151, "Xo_in": -2.22, "m_in": 1.286, "Ro_in": 2.821, "beta_in": 0.381, "Lu_ft": 64.3},
    "350S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.528, "weight_lbft": 1.8, "Ix_in4": 1.118, "Sx_in3": 0.639, "Rx_in": 1.455, "Iy_in4": 0.467, "Ry_in": 0.94, "Ixe_in4": 1.118, "Sxe_in3": 0.559, "Mal_inkip": 11.04, "Mad_inkip": 11.98, "Vag_lb": 2253.0, "Vnet_lb": 633.0, "Jx1000_in4": 0.564, "Cw_in6": 1.409, "Xo_in": -2.205, "m_in": 1.278, "Ro_in": 2.804, "beta_in": 0.382, "Lu_ft": 64.5},
    "350S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.528, "weight_lbft": 1.8, "Ix_in4": 1.118, "Sx_in3": 0.639, "Rx_in": 1.455, "Iy_in4": 0.467, "Ry_in": 0.94, "Ixe_in4": 1.113, "Sxe_in3": 0.494, "Mal_inkip": 14.78, "Mad_inkip": 15.92, "Vag_lb": 3372.0, "Vnet_lb": 947.0, "Jx1000_in4": 0.564, "Cw_in6": 1.409, "Xo_in": -2.205, "m_in": 1.278, "Ro_in": 2.804, "beta_in": 0.382, "Lu_ft": 52.1},
    "350S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.657, "weight_lbft": 2.24, "Ix_in4": 1.376, "Sx_in3": 0.787, "Rx_in": 1.447, "Iy_in4": 0.57, "Ry_in": 0.931, "Ixe_in4": 1.376, "Sxe_in3": 0.739, "Mal_inkip": 16.1, "Mad_inkip": 16.99, "Vag_lb": 2774.0, "Vnet_lb": 592.0, "Jx1000_in4": 1.114, "Cw_in6": 1.718, "Xo_in": -2.186, "m_in": 1.268, "Ro_in": 2.782, "beta_in": 0.383, "Lu_ft": 61.6},
    "350S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.657, "weight_lbft": 2.24, "Ix_in4": 1.376, "Sx_in3": 0.787, "Rx_in": 1.447, "Iy_in4": 0.57, "Ry_in": 0.931, "Ixe_in4": 1.376, "Sxe_in3": 0.661, "Mal_inkip": 19.78, "Mad_inkip": 21.31, "Vag_lb": 4202.0, "Vnet_lb": 897.0, "Jx1000_in4": 1.114, "Cw_in6": 1.718, "Xo_in": -2.186, "m_in": 1.268, "Ro_in": 2.782, "beta_in": 0.383, "Lu_ft": 52.2},
    "350S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.915, "weight_lbft": 3.11, "Ix_in4": 1.87, "Sx_in3": 1.069, "Rx_in": 1.43, "Iy_in4": 0.762, "Ry_in": 0.913, "Ixe_in4": 1.87, "Sxe_in3": 1.05, "Mal_inkip": 23.72, "Mad_inkip": 24.14, "Vag_lb": 3765.0, "Vnet_lb": 511.0, "Jx1000_in4": 3.154, "Cw_in6": 2.291, "Xo_in": -2.147, "m_in": 1.248, "Ro_in": 2.736, "beta_in": 0.384, "Lu_ft": 61.4},
    "350S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.915, "weight_lbft": 3.11, "Ix_in4": 1.87, "Sx_in3": 1.069, "Rx_in": 1.43, "Iy_in4": 0.762, "Ry_in": 0.913, "Ixe_in4": 1.87, "Sxe_in3": 0.998, "Mal_inkip": 33.58, "Mad_inkip": 35.43, "Vag_lb": 5704.0, "Vnet_lb": 775.0, "Jx1000_in4": 3.154, "Cw_in6": 2.291, "Xo_in": -2.147, "m_in": 1.248, "Ro_in": 2.736, "beta_in": 0.384, "Lu_ft": 49.5},
    "362S125-18_33ksi": {"thickness_in": 0.0188, "Fy_ksi": 33.0, "area_in2": 0.118, "weight_lbft": 0.4, "Ix_in4": 0.234, "Sx_in3": 0.129, "Rx_in": 1.409, "Iy_in4": 0.021, "Ry_in": 0.421, "Ixe_in4": 0.221, "Sxe_in3": 0.075, "Mal_inkip": 1.48, "Mad_inkip": 1.52, "Vag_lb": 173.0, "Vnet_lb": 163.0, "Jx1000_in4": 0.014, "Cw_in6": 0.054, "Xo_in": -0.786, "m_in": 0.49, "Ro_in": 1.667, "beta_in": 0.778, "Lu_ft": 28.8},
    "362S125-27_33ksi": {"thickness_in": 0.0283, "Fy_ksi": 33.0, "area_in2": 0.176, "weight_lbft": 0.6, "Ix_in4": 0.347, "Sx_in3": 0.192, "Rx_in": 1.404, "Iy_in4": 0.031, "Ry_in": 0.416, "Ixe_in4": 0.342, "Sxe_in3": 0.135, "Mal_inkip": 2.67, "Mad_inkip": 2.75, "Vag_lb": 592.0, "Vnet_lb": 370.0, "Jx1000_in4": 0.047, "Cw_in6": 0.079, "Xo_in": -0.776, "m_in": 0.484, "Ro_in": 1.657, "beta_in": 0.781, "Lu_ft": 28.6},
    "362S125-30_33ksi": {"thickness_in": 0.0312, "Fy_ksi": 33.0, "area_in2": 0.194, "weight_lbft": 0.66, "Ix_in4": 0.381, "Sx_in3": 0.21, "Rx_in": 1.402, "Iy_in4": 0.033, "Ry_in": 0.415, "Ixe_in4": 0.376, "Sxe_in3": 0.156, "Mal_inkip": 3.08, "Mad_inkip": 3.17, "Vag_lb": 794.0, "Vnet_lb": 449.0, "Jx1000_in4": 0.063, "Cw_in6": 0.086, "Xo_in": -0.773, "m_in": 0.482, "Ro_in": 1.654, "beta_in": 0.782, "Lu_ft": 28.6},
    "362S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.215, "weight_lbft": 0.73, "Ix_in4": 0.421, "Sx_in3": 0.232, "Rx_in": 1.4, "Iy_in4": 0.037, "Ry_in": 0.413, "Ixe_in4": 0.415, "Sxe_in3": 0.182, "Mal_inkip": 3.59, "Mad_inkip": 3.67, "Vag_lb": 1024.0, "Vnet_lb": 521.0, "Jx1000_in4": 0.086, "Cw_in6": 0.094, "Xo_in": -0.769, "m_in": 0.48, "Ro_in": 1.65, "beta_in": 0.783, "Lu_ft": 28.5},
    "362S125-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.278, "weight_lbft": 0.95, "Ix_in4": 0.54, "Sx_in3": 0.298, "Rx_in": 1.395, "Iy_in4": 0.046, "Ry_in": 0.408, "Ixe_in4": 0.537, "Sxe_in3": 0.269, "Mal_inkip": 5.31, "Mad_inkip": 5.33, "Vag_lb": 1739.0, "Vnet_lb": 676.0, "Jx1000_in4": 0.188, "Cw_in6": 0.118, "Xo_in": -0.758, "m_in": 0.473, "Ro_in": 1.639, "beta_in": 0.786, "Lu_ft": 28.4},
    "362S125-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.344, "weight_lbft": 1.17, "Ix_in4": 0.661, "Sx_in3": 0.365, "Rx_in": 1.386, "Iy_in4": 0.055, "Ry_in": 0.4, "Ixe_in4": 0.661, "Sxe_in3": 0.343, "Mal_inkip": 6.78, "Mad_inkip": 7.19, "Vag_lb": 2341.0, "Vnet_lb": 705.0, "Jx1000_in4": 0.367, "Cw_in6": 0.142, "Xo_in": -0.744, "m_in": 0.466, "Ro_in": 1.623, "beta_in": 0.79, "Lu_ft": 28.3},
    "362S125-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.344, "weight_lbft": 1.17, "Ix_in4": 0.661, "Sx_in3": 0.365, "Rx_in": 1.386, "Iy_in4": 0.055, "Ry_in": 0.4, "Ixe_in4": 0.656, "Sxe_in3": 0.321, "Mal_inkip": 9.62, "Mad_inkip": 9.65, "Vag_lb": 3372.0, "Vnet_lb": 1016.0, "Jx1000_in4": 0.367, "Cw_in6": 0.142, "Xo_in": -0.744, "m_in": 0.466, "Ro_in": 1.623, "beta_in": 0.79, "Lu_ft": 22.8},
    "362S125-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.426, "weight_lbft": 1.45, "Ix_in4": 0.803, "Sx_in3": 0.443, "Rx_in": 1.374, "Iy_in4": 0.065, "Ry_in": 0.389, "Ixe_in4": 0.802, "Sxe_in3": 0.43, "Mal_inkip": 8.51, "Mad_inkip": 8.76, "Vag_lb": 2884.0, "Vnet_lb": 662.0, "Jx1000_in4": 0.721, "Cw_in6": 0.169, "Xo_in": -0.726, "m_in": 0.457, "Ro_in": 1.602, "beta_in": 0.795, "Lu_ft": 28.2},
    "362S125-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.426, "weight_lbft": 1.45, "Ix_in4": 0.803, "Sx_in3": 0.443, "Rx_in": 1.374, "Iy_in4": 0.065, "Ry_in": 0.389, "Ixe_in4": 0.802, "Sxe_in3": 0.418, "Mal_inkip": 12.52, "Mad_inkip": 13.11, "Vag_lb": 4370.0, "Vnet_lb": 1004.0, "Jx1000_in4": 0.721, "Cw_in6": 0.169, "Xo_in": -0.726, "m_in": 0.457, "Ro_in": 1.602, "beta_in": 0.795, "Lu_ft": 22.7},
    "362S137-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.236, "weight_lbft": 0.8, "Ix_in4": 0.479, "Sx_in3": 0.264, "Rx_in": 1.424, "Iy_in4": 0.059, "Ry_in": 0.501, "Ixe_in4": 0.479, "Sxe_in3": 0.232, "Mal_inkip": 4.59, "Mad_inkip": 4.73, "Vag_lb": 1024.0, "Vnet_lb": 521.0, "Jx1000_in4": 0.094, "Cw_in6": 0.165, "Xo_in": -1.003, "m_in": 0.615, "Ro_in": 1.813, "beta_in": 0.694, "Lu_ft": 34.7},
    "362S137-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.306, "weight_lbft": 1.04, "Ix_in4": 0.616, "Sx_in3": 0.34, "Rx_in": 1.419, "Iy_in4": 0.075, "Ry_in": 0.497, "Ixe_in4": 0.616, "Sxe_in3": 0.32, "Mal_inkip": 6.32, "Mad_inkip": 6.65, "Vag_lb": 1739.0, "Vnet_lb": 676.0, "Jx1000_in4": 0.207, "Cw_in6": 0.208, "Xo_in": -0.991, "m_in": 0.608, "Ro_in": 1.801, "beta_in": 0.697, "Lu_ft": 34.6},
    "362S137-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.379, "weight_lbft": 1.29, "Ix_in4": 0.756, "Sx_in3": 0.417, "Rx_in": 1.411, "Iy_in4": 0.091, "Ry_in": 0.49, "Ixe_in4": 0.756, "Sxe_in3": 0.402, "Mal_inkip": 7.94, "Mad_inkip": 8.24, "Vag_lb": 2341.0, "Vnet_lb": 705.0, "Jx1000_in4": 0.405, "Cw_in6": 0.251, "Xo_in": -0.978, "m_in": 0.601, "Ro_in": 1.785, "beta_in": 0.7, "Lu_ft": 34.6},
    "362S137-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.379, "weight_lbft": 1.29, "Ix_in4": 0.756, "Sx_in3": 0.417, "Rx_in": 1.411, "Iy_in4": 0.091, "Ry_in": 0.49, "Ixe_in4": 0.756, "Sxe_in3": 0.381, "Mal_inkip": 11.42, "Mad_inkip": 11.91, "Vag_lb": 3372.0, "Vnet_lb": 1016.0, "Jx1000_in4": 0.405, "Cw_in6": 0.251, "Xo_in": -0.978, "m_in": 0.601, "Ro_in": 1.785, "beta_in": 0.7, "Lu_ft": 27.9},
    "362S137-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.47, "weight_lbft": 1.6, "Ix_in4": 0.922, "Sx_in3": 0.509, "Rx_in": 1.401, "Iy_in4": 0.109, "Ry_in": 0.48, "Ixe_in4": 0.922, "Sxe_in3": 0.498, "Mal_inkip": 9.84, "Mad_inkip": 10.05, "Vag_lb": 2884.0, "Vnet_lb": 662.0, "Jx1000_in4": 0.797, "Cw_in6": 0.302, "Xo_in": -0.959, "m_in": 0.592, "Ro_in": 1.764, "beta_in": 0.704, "Lu_ft": 34.6},
    "362S137-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.47, "weight_lbft": 1.6, "Ix_in4": 0.922, "Sx_in3": 0.509, "Rx_in": 1.401, "Iy_in4": 0.109, "Ry_in": 0.48, "Ixe_in4": 0.922, "Sxe_in3": 0.493, "Mal_inkip": 14.77, "Mad_inkip": 15.24, "Vag_lb": 4370.0, "Vnet_lb": 1004.0, "Jx1000_in4": 0.797, "Cw_in6": 0.302, "Xo_in": -0.959, "m_in": 0.592, "Ro_in": 1.764, "beta_in": 0.704, "Lu_ft": 27.8},
    "362S137-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.648, "weight_lbft": 2.2, "Ix_in4": 1.229, "Sx_in3": 0.678, "Rx_in": 1.377, "Iy_in4": 0.137, "Ry_in": 0.46, "Ixe_in4": 1.229, "Sxe_in3": 0.662, "Mal_inkip": 16.36, "Mad_inkip": 16.75, "Vag_lb": 3922.0, "Vnet_lb": 577.0, "Jx1000_in4": 2.233, "Cw_in6": 0.39, "Xo_in": -0.922, "m_in": 0.573, "Ro_in": 1.72, "beta_in": 0.713, "Lu_ft": 30.9},
    "362S137-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.648, "weight_lbft": 2.2, "Ix_in4": 1.229, "Sx_in3": 0.678, "Rx_in": 1.377, "Iy_in4": 0.137, "Ry_in": 0.46, "Ixe_in4": 1.229, "Sxe_in3": 0.662, "Mal_inkip": 24.1, "Mad_inkip": 24.67, "Vag_lb": 5943.0, "Vnet_lb": 875.0, "Jx1000_in4": 2.233, "Cw_in6": 0.39, "Xo_in": -0.922, "m_in": 0.573, "Ro_in": 1.72, "beta_in": 0.713, "Lu_ft": 25.1},
    "362S162-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.262, "weight_lbft": 0.89, "Ix_in4": 0.551, "Sx_in3": 0.304, "Rx_in": 1.45, "Iy_in4": 0.099, "Ry_in": 0.616, "Ixe_in4": 0.551, "Sxe_in3": 0.268, "Mal_inkip": 5.29, "Mad_inkip": 5.43, "Vag_lb": 1024.0, "Vnet_lb": 521.0, "Jx1000_in4": 0.105, "Cw_in6": 0.297, "Xo_in": -1.308, "m_in": 0.789, "Ro_in": 2.048, "beta_in": 0.592, "Lu_ft": 42.6},
    "362S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.34, "weight_lbft": 1.16, "Ix_in4": 0.71, "Sx_in3": 0.392, "Rx_in": 1.445, "Iy_in4": 0.127, "Ry_in": 0.611, "Ixe_in4": 0.71, "Sxe_in3": 0.372, "Mal_inkip": 7.34, "Mad_inkip": 7.62, "Vag_lb": 1739.0, "Vnet_lb": 676.0, "Jx1000_in4": 0.23, "Cw_in6": 0.376, "Xo_in": -1.297, "m_in": 0.782, "Ro_in": 2.036, "beta_in": 0.594, "Lu_ft": 42.5},
    "362S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.422, "weight_lbft": 1.44, "Ix_in4": 0.873, "Sx_in3": 0.481, "Rx_in": 1.438, "Iy_in4": 0.154, "Ry_in": 0.604, "Ixe_in4": 0.873, "Sxe_in3": 0.466, "Mal_inkip": 9.22, "Mad_inkip": 9.51, "Vag_lb": 2341.0, "Vnet_lb": 705.0, "Jx1000_in4": 0.451, "Cw_in6": 0.457, "Xo_in": -1.283, "m_in": 0.774, "Ro_in": 2.02, "beta_in": 0.597, "Lu_ft": 42.5},
    "362S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.422, "weight_lbft": 1.44, "Ix_in4": 0.873, "Sx_in3": 0.481, "Rx_in": 1.438, "Iy_in4": 0.154, "Ry_in": 0.604, "Ixe_in4": 0.873, "Sxe_in3": 0.444, "Mal_inkip": 13.28, "Mad_inkip": 13.59, "Vag_lb": 3372.0, "Vnet_lb": 1016.0, "Jx1000_in4": 0.451, "Cw_in6": 0.457, "Xo_in": -1.283, "m_in": 0.774, "Ro_in": 2.02, "beta_in": 0.597, "Lu_ft": 34.4},
    "362S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.524, "weight_lbft": 1.78, "Ix_in4": 1.069, "Sx_in3": 0.59, "Rx_in": 1.429, "Iy_in4": 0.186, "Ry_in": 0.596, "Ixe_in4": 1.069, "Sxe_in3": 0.579, "Mal_inkip": 11.43, "Mad_inkip": 11.65, "Vag_lb": 2884.0, "Vnet_lb": 662.0, "Jx1000_in4": 0.887, "Cw_in6": 0.552, "Xo_in": -1.264, "m_in": 0.765, "Ro_in": 1.998, "beta_in": 0.6, "Lu_ft": 42.7},
    "362S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.524, "weight_lbft": 1.78, "Ix_in4": 1.069, "Sx_in3": 0.59, "Rx_in": 1.429, "Iy_in4": 0.186, "Ry_in": 0.596, "Ixe_in4": 1.069, "Sxe_in3": 0.574, "Mal_inkip": 17.18, "Mad_inkip": 17.65, "Vag_lb": 4370.0, "Vnet_lb": 1004.0, "Jx1000_in4": 0.887, "Cw_in6": 0.552, "Xo_in": -1.264, "m_in": 0.765, "Ro_in": 1.998, "beta_in": 0.6, "Lu_ft": 34.3},
    "362S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.724, "weight_lbft": 2.46, "Ix_in4": 1.435, "Sx_in3": 0.792, "Rx_in": 1.408, "Iy_in4": 0.241, "Ry_in": 0.577, "Ixe_in4": 1.435, "Sxe_in3": 0.776, "Mal_inkip": 18.62, "Mad_inkip": 19.0, "Vag_lb": 3922.0, "Vnet_lb": 577.0, "Jx1000_in4": 2.496, "Cw_in6": 0.723, "Xo_in": -1.226, "m_in": 0.745, "Ro_in": 1.954, "beta_in": 0.606, "Lu_ft": 38.9},
    "362S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.724, "weight_lbft": 2.46, "Ix_in4": 1.435, "Sx_in3": 0.792, "Rx_in": 1.408, "Iy_in4": 0.241, "Ry_in": 0.577, "Ixe_in4": 1.435, "Sxe_in3": 0.776, "Mal_inkip": 27.52, "Mad_inkip": 28.08, "Vag_lb": 5943.0, "Vnet_lb": 875.0, "Jx1000_in4": 2.496, "Cw_in6": 0.723, "Xo_in": -1.226, "m_in": 0.745, "Ro_in": 1.954, "beta_in": 0.606, "Lu_ft": 31.5},
    "362S200-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.297, "weight_lbft": 1.01, "Ix_in4": 0.648, "Sx_in3": 0.358, "Rx_in": 1.478, "Iy_in4": 0.177, "Ry_in": 0.772, "Ixe_in4": 0.647, "Sxe_in3": 0.294, "Mal_inkip": 5.81, "Mad_inkip": 6.19, "Vag_lb": 1024.0, "Vnet_lb": 521.0, "Jx1000_in4": 0.118, "Cw_in6": 0.577, "Xo_in": -1.741, "m_in": 1.03, "Ro_in": 2.411, "beta_in": 0.478, "Lu_ft": 53.6},
    "362S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.385, "weight_lbft": 1.31, "Ix_in4": 0.836, "Sx_in3": 0.461, "Rx_in": 1.474, "Iy_in4": 0.227, "Ry_in": 0.767, "Ixe_in4": 0.836, "Sxe_in3": 0.427, "Mal_inkip": 8.43, "Mad_inkip": 8.7, "Vag_lb": 1739.0, "Vnet_lb": 676.0, "Jx1000_in4": 0.261, "Cw_in6": 0.734, "Xo_in": -1.729, "m_in": 1.024, "Ro_in": 2.398, "beta_in": 0.48, "Lu_ft": 53.5},
    "362S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.479, "weight_lbft": 1.63, "Ix_in4": 1.03, "Sx_in3": 0.568, "Rx_in": 1.467, "Iy_in4": 0.277, "Ry_in": 0.761, "Ixe_in4": 1.03, "Sxe_in3": 0.553, "Mal_inkip": 10.93, "Mad_inkip": 11.23, "Vag_lb": 2341.0, "Vnet_lb": 705.0, "Jx1000_in4": 0.511, "Cw_in6": 0.896, "Xo_in": -1.715, "m_in": 1.016, "Ro_in": 2.382, "beta_in": 0.482, "Lu_ft": 53.6},
    "362S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.479, "weight_lbft": 1.63, "Ix_in4": 1.03, "Sx_in3": 0.568, "Rx_in": 1.467, "Iy_in4": 0.277, "Ry_in": 0.761, "Ixe_in4": 1.03, "Sxe_in3": 0.49, "Mal_inkip": 14.66, "Mad_inkip": 15.47, "Vag_lb": 3372.0, "Vnet_lb": 1016.0, "Jx1000_in4": 0.511, "Cw_in6": 0.896, "Xo_in": -1.715, "m_in": 1.016, "Ro_in": 2.382, "beta_in": 0.482, "Lu_ft": 43.3},
    "362S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.595, "weight_lbft": 2.02, "Ix_in4": 1.265, "Sx_in3": 0.698, "Rx_in": 1.458, "Iy_in4": 0.337, "Ry_in": 0.753, "Ixe_in4": 1.265, "Sxe_in3": 0.687, "Mal_inkip": 15.29, "Mad_inkip": 2.0, "Vag_lb": 15.54, "Vnet_lb": 2884.0, "Jx1000_in4": 662.0, "Cw_in6": 1.008, "Xo_in": 1.089, "m_in": -1.696, "Ro_in": 1.006, "beta_in": 2.36, "Lu_ft": 0.484},
    "362S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.595, "weight_lbft": 2.02, "Ix_in4": 1.265, "Sx_in3": 0.698, "Rx_in": 1.458, "Iy_in4": 0.337, "Ry_in": 0.753, "Ixe_in4": 1.265, "Sxe_in3": 0.666, "Mal_inkip": 19.95, "Mad_inkip": 20.51, "Vag_lb": 4370.0, "Vnet_lb": 1004.0, "Jx1000_in4": 1.008, "Cw_in6": 1.089, "Xo_in": -1.696, "m_in": 1.006, "Ro_in": 2.36, "beta_in": 0.484, "Lu_ft": 43.3},
    "362S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.826, "weight_lbft": 2.81, "Ix_in4": 1.711, "Sx_in3": 0.944, "Rx_in": 1.44, "Iy_in4": 0.446, "Ry_in": 0.735, "Ixe_in4": 1.711, "Sxe_in3": 0.928, "Mal_inkip": 21.59, "Mad_inkip": 21.95, "Vag_lb": 3922.0, "Vnet_lb": 577.0, "Jx1000_in4": 2.847, "Cw_in6": 1.441, "Xo_in": -1.658, "m_in": 0.986, "Ro_in": 2.315, "beta_in": 0.487, "Lu_ft": 50.0},
    "362S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.826, "weight_lbft": 2.81, "Ix_in4": 1.711, "Sx_in3": 0.944, "Rx_in": 1.44, "Iy_in4": 0.446, "Ry_in": 0.735, "Ixe_in4": 1.711, "Sxe_in3": 0.928, "Mal_inkip": 32.03, "Mad_inkip": 32.57, "Vag_lb": 5943.0, "Vnet_lb": 875.0, "Jx1000_in4": 2.847, "Cw_in6": 1.441, "Xo_in": -1.658, "m_in": 0.986, "Ro_in": 2.315, "beta_in": 0.487, "Lu_ft": 40.5},
    "362S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.43, "weight_lbft": 1.46, "Ix_in4": 0.98, "Sx_in3": 0.541, "Rx_in": 1.51, "Iy_in4": 0.385, "Ry_in": 0.946, "Ixe_in4": 0.98, "Sxe_in3": 0.449, "Mal_inkip": 8.88, "Mad_inkip": 9.35, "Vag_lb": 1739.0, "Vnet_lb": 676.0, "Jx1000_in4": 0.292, "Cw_in6": 1.23, "Xo_in": -2.199, "m_in": 1.277, "Ro_in": 2.83, "beta_in": 0.396, "Lu_ft": 64.2},
    "362S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.535, "weight_lbft": 1.82, "Ix_in4": 1.21, "Sx_in3": 0.668, "Rx_in": 1.504, "Iy_in4": 0.473, "Ry_in": 0.94, "Ixe_in4": 1.21, "Sxe_in3": 0.582, "Mal_inkip": 11.51, "Mad_inkip": 12.46, "Vag_lb": 2341.0, "Vnet_lb": 705.0, "Jx1000_in4": 0.571, "Cw_in6": 1.506, "Xo_in": -2.184, "m_in": 1.269, "Ro_in": 2.813, "beta_in": 0.397, "Lu_ft": 64.3},
    "362S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.535, "weight_lbft": 1.82, "Ix_in4": 1.21, "Sx_in3": 0.668, "Rx_in": 1.504, "Iy_in4": 0.473, "Ry_in": 0.94, "Ixe_in4": 1.205, "Sxe_in3": 0.514, "Mal_inkip": 15.4, "Mad_inkip": 16.54, "Vag_lb": 3372.0, "Vnet_lb": 1016.0, "Jx1000_in4": 0.571, "Cw_in6": 1.506, "Xo_in": -2.184, "m_in": 1.269, "Ro_in": 2.813, "beta_in": 0.397, "Lu_ft": 52.0},
    "362S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.666, "weight_lbft": 2.27, "Ix_in4": 1.49, "Sx_in3": 0.822, "Rx_in": 1.496, "Iy_in4": 0.578, "Ry_in": 0.931, "Ixe_in4": 1.49, "Sxe_in3": 0.774, "Mal_inkip": 16.85, "Mad_inkip": 17.68, "Vag_lb": 2884.0, "Vnet_lb": 662.0, "Jx1000_in4": 1.129, "Cw_in6": 1.837, "Xo_in": -2.165, "m_in": 1.259, "Ro_in": 2.791, "beta_in": 0.398, "Lu_ft": 61.4},
    "362S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.666, "weight_lbft": 2.27, "Ix_in4": 1.49, "Sx_in3": 0.822, "Rx_in": 1.496, "Iy_in4": 0.578, "Ry_in": 0.931, "Ixe_in4": 1.49, "Sxe_in3": 0.689, "Mal_inkip": 20.63, "Mad_inkip": 22.17, "Vag_lb": 4370.0, "Vnet_lb": 1004.0, "Jx1000_in4": 1.129, "Cw_in6": 1.837, "Xo_in": -2.165, "m_in": 1.259, "Ro_in": 2.791, "beta_in": 0.398, "Lu_ft": 52.0},
    "362S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.927, "weight_lbft": 3.16, "Ix_in4": 2.027, "Sx_in3": 1.118, "Rx_in": 1.478, "Iy_in4": 0.772, "Ry_in": 0.912, "Ixe_in4": 2.027, "Sxe_in3": 1.1, "Mal_inkip": 24.85, "Mad_inkip": 25.26, "Vag_lb": 3922.0, "Vnet_lb": 577.0, "Jx1000_in4": 3.197, "Cw_in6": 2.452, "Xo_in": -2.126, "m_in": 1.239, "Ro_in": 2.746, "beta_in": 0.4, "Lu_ft": 61.0},
    "362S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.927, "weight_lbft": 3.16, "Ix_in4": 2.027, "Sx_in3": 1.118, "Rx_in": 1.478, "Iy_in4": 0.772, "Ry_in": 0.912, "Ixe_in4": 2.027, "Sxe_in3": 1.046, "Mal_inkip": 35.17, "Mad_inkip": 36.93, "Vag_lb": 5943.0, "Vnet_lb": 875.0, "Jx1000_in4": 3.197, "Cw_in6": 2.452, "Xo_in": -2.126, "m_in": 1.239, "Ro_in": 2.746, "beta_in": 0.4, "Lu_ft": 49.3},
    "362S300-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.592, "weight_lbft": 2.01, "Ix_in4": 1.39, "Sx_in3": 0.767, "Rx_in": 1.533, "Iy_in4": 0.734, "Ry_in": 1.114, "Ixe_in4": 1.383, "Sxe_in3": 0.607, "Mal_inkip": 11.99, "Mad_inkip": 13.22, "Vag_lb": 2341.0, "Vnet_lb": 705.0, "Jx1000_in4": 0.632, "Cw_in6": 2.316, "Xo_in": -2.659, "m_in": 1.522, "Ro_in": 3.265, "beta_in": 0.337, "Lu_ft": 74.5},
    "362S300-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.592, "weight_lbft": 2.01, "Ix_in4": 1.39, "Sx_in3": 0.767, "Rx_in": 1.533, "Iy_in4": 0.734, "Ry_in": 1.114, "Ixe_in4": 1.312, "Sxe_in3": 0.529, "Mal_inkip": 15.83, "Mad_inkip": 17.34, "Vag_lb": 3372.0, "Vnet_lb": 1016.0, "Jx1000_in4": 0.632, "Cw_in6": 2.316, "Xo_in": -2.659, "m_in": 1.522, "Ro_in": 3.265, "beta_in": 0.337, "Lu_ft": 60.2},
    "362S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.738, "weight_lbft": 2.51, "Ix_in4": 1.716, "Sx_in3": 0.947, "Rx_in": 1.525, "Iy_in4": 0.9, "Ry_in": 1.105, "Ixe_in4": 1.716, "Sxe_in3": 0.811, "Mal_inkip": 16.02, "Mad_inkip": 17.65, "Vag_lb": 2884.0, "Vnet_lb": 662.0, "Jx1000_in4": 1.25, "Cw_in6": 2.833, "Xo_in": -2.64, "m_in": 1.512, "Ro_in": 3.243, "beta_in": 0.337, "Lu_ft": 74.9},
    "362S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.738, "weight_lbft": 2.51, "Ix_in4": 1.716, "Sx_in3": 0.947, "Rx_in": 1.525, "Iy_in4": 0.9, "Ry_in": 1.105, "Ixe_in4": 1.684, "Sxe_in3": 0.716, "Mal_inkip": 21.44, "Mad_inkip": 23.42, "Vag_lb": 4370.0, "Vnet_lb": 1004.0, "Jx1000_in4": 1.25, "Cw_in6": 2.833, "Xo_in": -2.64, "m_in": 1.512, "Ro_in": 3.243, "beta_in": 0.337, "Lu_ft": 60.4},
    "362S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.029, "weight_lbft": 3.5, "Ix_in4": 2.343, "Sx_in3": 1.292, "Rx_in": 1.509, "Iy_in4": 1.213, "Ry_in": 1.086, "Ixe_in4": 2.343, "Sxe_in3": 1.217, "Mal_inkip": 26.95, "Mad_inkip": 28.61, "Vag_lb": 3922.0, "Vnet_lb": 577.0, "Jx1000_in4": 3.548, "Cw_in6": 3.803, "Xo_in": -2.6, "m_in": 1.491, "Ro_in": 3.196, "beta_in": 0.338, "Lu_ft": 71.6},
    "362S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.029, "weight_lbft": 3.5, "Ix_in4": 2.343, "Sx_in3": 1.292, "Rx_in": 1.509, "Iy_in4": 1.213, "Ry_in": 1.086, "Ixe_in4": 2.32, "Sxe_in3": 1.15, "Mal_inkip": 34.42, "Mad_inkip": 36.41, "Vag_lb": 5943.0, "Vnet_lb": 875.0, "Jx1000_in4": 3.548, "Cw_in6": 3.803, "Xo_in": -2.6, "m_in": 1.491, "Ro_in": 3.196, "beta_in": 0.338, "Lu_ft": 60.9},
    "400S125-18_33ksi": {"thickness_in": 0.0188, "Fy_ksi": 33.0, "area_in2": 0.125, "weight_lbft": 0.42, "Ix_in4": 0.294, "Sx_in3": 0.147, "Rx_in": 1.536, "Iy_in4": 0.021, "Ry_in": 0.414, "Ixe_in4": 0.281, "Sxe_in3": 0.083, "Mal_inkip": 1.64, "Mad_inkip": 1.68, "Vag_lb": 156.0, "Vnet_lb": 156.0, "Jx1000_in4": 0.015, "Cw_in6": 0.068, "Xo_in": -0.754, "m_in": 0.475, "Ro_in": 1.76, "beta_in": 0.816, "Lu_ft": 28.7},
    "400S125-27_33ksi": {"thickness_in": 0.0283, "Fy_ksi": 33.0, "area_in2": 0.187, "weight_lbft": 0.64, "Ix_in4": 0.438, "Sx_in3": 0.219, "Rx_in": 1.531, "Iy_in4": 0.031, "Ry_in": 0.41, "Ixe_in4": 0.431, "Sxe_in3": 0.151, "Mal_inkip": 2.97, "Mad_inkip": 3.07, "Vag_lb": 533.0, "Vnet_lb": 398.0, "Jx1000_in4": 0.05, "Cw_in6": 0.098, "Xo_in": -0.744, "m_in": 0.469, "Ro_in": 1.751, "beta_in": 0.819, "Lu_ft": 28.5},
    "400S125-30_33ksi": {"thickness_in": 0.0312, "Fy_ksi": 33.0, "area_in2": 0.206, "weight_lbft": 0.7, "Ix_in4": 0.481, "Sx_in3": 0.24, "Rx_in": 1.529, "Iy_in4": 0.034, "Ry_in": 0.408, "Ixe_in4": 0.474, "Sxe_in3": 0.174, "Mal_inkip": 3.44, "Mad_inkip": 3.53, "Vag_lb": 715.0, "Vnet_lb": 484.0, "Jx1000_in4": 0.067, "Cw_in6": 0.107, "Xo_in": -0.741, "m_in": 0.467, "Ro_in": 1.748, "beta_in": 0.82, "Lu_ft": 28.5},
    "400S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.228, "weight_lbft": 0.77, "Ix_in4": 0.531, "Sx_in3": 0.265, "Rx_in": 1.527, "Iy_in4": 0.038, "Ry_in": 0.407, "Ixe_in4": 0.524, "Sxe_in3": 0.203, "Mal_inkip": 4.01, "Mad_inkip": 4.1, "Vag_lb": 976.0, "Vnet_lb": 595.0, "Jx1000_in4": 0.091, "Cw_in6": 0.118, "Xo_in": -0.738, "m_in": 0.465, "Ro_in": 1.744, "beta_in": 0.821, "Lu_ft": 28.4},
    "400S125-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.295, "weight_lbft": 1.0, "Ix_in4": 0.682, "Sx_in3": 0.341, "Rx_in": 1.521, "Iy_in4": 0.048, "Ry_in": 0.402, "Ixe_in4": 0.68, "Sxe_in3": 0.301, "Mal_inkip": 5.96, "Mad_inkip": 5.99, "Vag_lb": 1739.0, "Vnet_lb": 810.0, "Jx1000_in4": 0.2, "Cw_in6": 0.148, "Xo_in": -0.727, "m_in": 0.459, "Ro_in": 1.733, "beta_in": 0.824, "Lu_ft": 28.2},
    "400S125-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.365, "weight_lbft": 1.24, "Ix_in4": 0.835, "Sx_in3": 0.418, "Rx_in": 1.512, "Iy_in4": 0.057, "Ry_in": 0.394, "Ixe_in4": 0.835, "Sxe_in3": 0.387, "Mal_inkip": 7.65, "Mad_inkip": 8.12, "Vag_lb": 2603.0, "Vnet_lb": 944.0, "Jx1000_in4": 0.39, "Cw_in6": 0.178, "Xo_in": -0.713, "m_in": 0.451, "Ro_in": 1.718, "beta_in": 0.828, "Lu_ft": 28.1},
    "400S125-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.365, "weight_lbft": 1.24, "Ix_in4": 0.835, "Sx_in3": 0.418, "Rx_in": 1.512, "Iy_in4": 0.057, "Ry_in": 0.394, "Ixe_in4": 0.83, "Sxe_in3": 0.361, "Mal_inkip": 10.81, "Mad_inkip": 10.87, "Vag_lb": 3372.0, "Vnet_lb": 1223.0, "Jx1000_in4": 0.39, "Cw_in6": 0.178, "Xo_in": -0.713, "m_in": 0.451, "Ro_in": 1.718, "beta_in": 0.828, "Lu_ft": 22.7},
    "400S125-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.452, "weight_lbft": 1.54, "Ix_in4": 1.017, "Sx_in3": 0.509, "Rx_in": 1.499, "Iy_in4": 0.066, "Ry_in": 0.383, "Ixe_in4": 1.015, "Sxe_in3": 0.492, "Mal_inkip": 9.72, "Mad_inkip": 10.05, "Vag_lb": 3215.0, "Vnet_lb": 895.0, "Jx1000_in4": 0.767, "Cw_in6": 0.213, "Xo_in": -0.695, "m_in": 0.442, "Ro_in": 1.696, "beta_in": 0.832, "Lu_ft": 28.0},
    "400S125-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.452, "weight_lbft": 1.54, "Ix_in4": 1.017, "Sx_in3": 0.509, "Rx_in": 1.499, "Iy_in4": 0.066, "Ry_in": 0.383, "Ixe_in4": 1.015, "Sxe_in3": 0.474, "Mal_inkip": 14.18, "Mad_inkip": 14.84, "Vag_lb": 4871.0, "Vnet_lb": 1356.0, "Jx1000_in4": 0.767, "Cw_in6": 0.213, "Xo_in": -0.695, "m_in": 0.442, "Ro_in": 1.696, "beta_in": 0.832, "Lu_ft": 22.5},
    "400S137-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.249, "weight_lbft": 0.85, "Ix_in4": 0.603, "Sx_in3": 0.301, "Rx_in": 1.556, "Iy_in4": 0.061, "Ry_in": 0.496, "Ixe_in4": 0.603, "Sxe_in3": 0.259, "Mal_inkip": 5.12, "Mad_inkip": 5.29, "Vag_lb": 976.0, "Vnet_lb": 595.0, "Jx1000_in4": 0.099, "Cw_in6": 0.204, "Xo_in": -0.965, "m_in": 0.597, "Ro_in": 1.897, "beta_in": 0.741, "Lu_ft": 34.5},
    "400S137-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.323, "weight_lbft": 1.1, "Ix_in4": 0.776, "Sx_in3": 0.388, "Rx_in": 1.551, "Iy_in4": 0.078, "Ry_in": 0.491, "Ixe_in4": 0.776, "Sxe_in3": 0.359, "Mal_inkip": 7.09, "Mad_inkip": 7.47, "Vag_lb": 1739.0, "Vnet_lb": 810.0, "Jx1000_in4": 0.219, "Cw_in6": 0.257, "Xo_in": -0.954, "m_in": 0.591, "Ro_in": 1.885, "beta_in": 0.744, "Lu_ft": 34.3},
    "400S137-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.401, "weight_lbft": 1.36, "Ix_in4": 0.953, "Sx_in3": 0.477, "Rx_in": 1.542, "Iy_in4": 0.094, "Ry_in": 0.484, "Ixe_in4": 0.953, "Sxe_in3": 0.428, "Mal_inkip": 12.82, "Mad_inkip": 13.38, "Vag_lb": 3372.0, "Vnet_lb": 1223.0, "Jx1000_in4": 0.428, "Cw_in6": 0.311, "Xo_in": -0.94, "m_in": 0.583, "Ro_in": 1.87, "beta_in": 0.747, "Lu_ft": 27.7},
    "400S137-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.497, "weight_lbft": 1.69, "Ix_in4": 1.165, "Sx_in3": 0.582, "Rx_in": 1.531, "Iy_in4": 0.112, "Ry_in": 0.475, "Ixe_in4": 1.165, "Sxe_in3": 0.567, "Mal_inkip": 11.21, "Mad_inkip": 11.51, "Vag_lb": 3215.0, "Vnet_lb": 895.0, "Jx1000_in4": 0.842, "Cw_in6": 0.375, "Xo_in": -0.922, "m_in": 0.574, "Ro_in": 1.849, "beta_in": 0.751, "Lu_ft": 34.2},
    "400S137-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.497, "weight_lbft": 1.69, "Ix_in4": 1.165, "Sx_in3": 0.582, "Rx_in": 1.531, "Iy_in4": 0.112, "Ry_in": 0.475, "Ixe_in4": 1.165, "Sxe_in3": 0.558, "Mal_inkip": 16.7, "Mad_inkip": 17.44, "Vag_lb": 4871.0, "Vnet_lb": 1356.0, "Jx1000_in4": 0.842, "Cw_in6": 0.375, "Xo_in": -0.922, "m_in": 0.574, "Ro_in": 1.849, "beta_in": 0.751, "Lu_ft": 27.6},
    "400S137-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.686, "weight_lbft": 2.33, "Ix_in4": 1.557, "Sx_in3": 0.779, "Rx_in": 1.507, "Iy_in4": 0.142, "Ry_in": 0.454, "Ixe_in4": 1.557, "Sxe_in3": 0.764, "Mal_inkip": 18.88, "Mad_inkip": 19.23, "Vag_lb": 4394.0, "Vnet_lb": 797.0, "Jx1000_in4": 2.365, "Cw_in6": 0.486, "Xo_in": -0.885, "m_in": 0.555, "Ro_in": 1.806, "beta_in": 0.76, "Lu_ft": 30.5},
    "400S137-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.686, "weight_lbft": 2.33, "Ix_in4": 1.557, "Sx_in3": 0.779, "Rx_in": 1.507, "Iy_in4": 0.142, "Ry_in": 0.454, "Ixe_in4": 1.557, "Sxe_in3": 0.764, "Mal_inkip": 27.81, "Mad_inkip": 28.33, "Vag_lb": 6658.0, "Vnet_lb": 1207.0, "Jx1000_in4": 2.365, "Cw_in6": 0.486, "Xo_in": -0.885, "m_in": 0.555, "Ro_in": 1.806, "beta_in": 0.76, "Lu_ft": 24.8},
    "400S162-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.275, "weight_lbft": 0.94, "Ix_in4": 0.692, "Sx_in3": 0.346, "Rx_in": 1.586, "Iy_in4": 0.103, "Ry_in": 0.611, "Ixe_in4": 0.692, "Sxe_in3": 0.299, "Mal_inkip": 5.91, "Mad_inkip": 6.07, "Vag_lb": 976.0, "Vnet_lb": 595.0, "Jx1000_in4": 0.11, "Cw_in6": 0.363, "Xo_in": -1.263, "m_in": 0.768, "Ro_in": 2.118, "beta_in": 0.644, "Lu_ft": 42.3},
    "400S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.357, "weight_lbft": 1.21, "Ix_in4": 0.892, "Sx_in3": 0.446, "Rx_in": 1.581, "Iy_in4": 0.131, "Ry_in": 0.606, "Ixe_in4": 0.892, "Sxe_in3": 0.417, "Mal_inkip": 8.23, "Mad_inkip": 8.54, "Vag_lb": 1739.0, "Vnet_lb": 810.0, "Jx1000_in4": 0.242, "Cw_in6": 0.46, "Xo_in": -1.252, "m_in": 0.761, "Ro_in": 2.106, "beta_in": 0.647, "Lu_ft": 42.2},
    "400S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.443, "weight_lbft": 1.51, "Ix_in4": 1.098, "Sx_in3": 0.549, "Rx_in": 1.574, "Iy_in4": 0.159, "Ry_in": 0.6, "Ixe_in4": 1.098, "Sxe_in3": 0.526, "Mal_inkip": 10.39, "Mad_inkip": 10.84, "Vag_lb": 2603.0, "Vnet_lb": 944.0, "Jx1000_in4": 0.473, "Cw_in6": 0.56, "Xo_in": -1.238, "m_in": 0.754, "Ro_in": 2.09, "beta_in": 0.649, "Lu_ft": 42.2},
    "400S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.443, "weight_lbft": 1.51, "Ix_in4": 1.098, "Sx_in3": 0.549, "Rx_in": 1.574, "Iy_in4": 0.159, "Ry_in": 0.6, "Ixe_in4": 1.098, "Sxe_in3": 0.498, "Mal_inkip": 14.9, "Mad_inkip": 15.25, "Vag_lb": 3372.0, "Vnet_lb": 1223.0, "Jx1000_in4": 0.473, "Cw_in6": 0.56, "Xo_in": -1.238, "m_in": 0.754, "Ro_in": 2.09, "beta_in": 0.649, "Lu_ft": 34.1},
    "400S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.55, "weight_lbft": 1.87, "Ix_in4": 1.346, "Sx_in3": 0.673, "Rx_in": 1.564, "Iy_in4": 0.192, "Ry_in": 0.591, "Ixe_in4": 1.346, "Sxe_in3": 0.658, "Mal_inkip": 13.0, "Mad_inkip": 13.3, "Vag_lb": 3215.0, "Vnet_lb": 895.0, "Jx1000_in4": 0.933, "Cw_in6": 0.677, "Xo_in": -1.22, "m_in": 0.745, "Ro_in": 2.069, "beta_in": 0.653, "Lu_ft": 42.2},
    "400S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.55, "weight_lbft": 1.87, "Ix_in4": 1.346, "Sx_in3": 0.673, "Rx_in": 1.564, "Iy_in4": 0.192, "Ry_in": 0.591, "Ixe_in4": 1.346, "Sxe_in3": 0.648, "Mal_inkip": 19.41, "Mad_inkip": 20.15, "Vag_lb": 4871.0, "Vnet_lb": 1356.0, "Jx1000_in4": 0.933, "Cw_in6": 0.677, "Xo_in": -1.22, "m_in": 0.745, "Ro_in": 2.069, "beta_in": 0.653, "Lu_ft": 34.0},
    "400S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.762, "weight_lbft": 2.59, "Ix_in4": 1.812, "Sx_in3": 0.906, "Rx_in": 1.542, "Iy_in4": 0.249, "Ry_in": 0.572, "Ixe_in4": 1.812, "Sxe_in3": 0.892, "Mal_inkip": 21.4, "Mad_inkip": 21.75, "Vag_lb": 4394.0, "Vnet_lb": 797.0, "Jx1000_in4": 2.628, "Cw_in6": 0.889, "Xo_in": -1.182, "m_in": 0.725, "Ro_in": 2.025, "beta_in": 0.659, "Lu_ft": 38.3},
    "400S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.762, "weight_lbft": 2.59, "Ix_in4": 1.812, "Sx_in3": 0.906, "Rx_in": 1.542, "Iy_in4": 0.249, "Ry_in": 0.572, "Ixe_in4": 1.812, "Sxe_in3": 0.892, "Mal_inkip": 31.64, "Mad_inkip": 32.15, "Vag_lb": 6658.0, "Vnet_lb": 1207.0, "Jx1000_in4": 2.628, "Cw_in6": 0.889, "Xo_in": -1.182, "m_in": 0.725, "Ro_in": 2.025, "beta_in": 0.659, "Lu_ft": 31.1},
    "400S200-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.31, "weight_lbft": 1.05, "Ix_in4": 0.812, "Sx_in3": 0.406, "Rx_in": 1.619, "Iy_in4": 0.183, "Ry_in": 0.769, "Ixe_in4": 0.812, "Sxe_in3": 0.328, "Mal_inkip": 6.49, "Mad_inkip": 6.9, "Vag_lb": 976.0, "Vnet_lb": 595.0, "Jx1000_in4": 0.124, "Cw_in6": 0.697, "Xo_in": -1.688, "m_in": 1.007, "Ro_in": 2.462, "beta_in": 0.53, "Lu_ft": 53.1},
    "400S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.402, "weight_lbft": 1.37, "Ix_in4": 1.047, "Sx_in3": 0.524, "Rx_in": 1.615, "Iy_in4": 0.235, "Ry_in": 0.764, "Ixe_in4": 1.047, "Sxe_in3": 0.478, "Mal_inkip": 9.45, "Mad_inkip": 9.74, "Vag_lb": 1739.0, "Vnet_lb": 810.0, "Jx1000_in4": 0.272, "Cw_in6": 0.886, "Xo_in": -1.676, "m_in": 1.0, "Ro_in": 2.449, "beta_in": 0.532, "Lu_ft": 53.0},
    "400S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.5, "weight_lbft": 1.7, "Ix_in4": 1.292, "Sx_in3": 0.646, "Rx_in": 1.608, "Iy_in4": 0.287, "Ry_in": 0.758, "Ixe_in4": 1.292, "Sxe_in3": 0.623, "Mal_inkip": 12.3, "Mad_inkip": 12.77, "Vag_lb": 2603.0, "Vnet_lb": 944.0, "Jx1000_in4": 0.534, "Cw_in6": 1.083, "Xo_in": -1.662, "m_in": 0.993, "Ro_in": 2.433, "beta_in": 0.534, "Lu_ft": 53.0},
    "400S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.5, "weight_lbft": 1.7, "Ix_in4": 1.292, "Sx_in3": 0.646, "Rx_in": 1.608, "Iy_in4": 0.287, "Ry_in": 0.758, "Ixe_in4": 1.292, "Sxe_in3": 0.549, "Mal_inkip": 16.43, "Mad_inkip": 17.31, "Vag_lb": 3372.0, "Vnet_lb": 1223.0, "Jx1000_in4": 0.534, "Cw_in6": 1.083, "Xo_in": -1.662, "m_in": 0.993, "Ro_in": 2.433, "beta_in": 0.534, "Lu_ft": 42.9},
    "400S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.622, "weight_lbft": 2.12, "Ix_in4": 1.589, "Sx_in3": 0.795, "Rx_in": 1.599, "Iy_in4": 0.349, "Ry_in": 0.75, "Ixe_in4": 1.589, "Sxe_in3": 0.78, "Mal_inkip": 15.4, "Mad_inkip": 15.7, "Vag_lb": 3215.0, "Vnet_lb": 895.0, "Jx1000_in4": 1.054, "Cw_in6": 1.318, "Xo_in": -1.643, "m_in": 0.983, "Ro_in": 2.412, "beta_in": 0.536, "Lu_ft": 53.2},
    "400S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.622, "weight_lbft": 2.12, "Ix_in4": 1.589, "Sx_in3": 0.795, "Rx_in": 1.599, "Iy_in4": 0.349, "Ry_in": 0.75, "Ixe_in4": 1.589, "Sxe_in3": 0.751, "Mal_inkip": 22.48, "Mad_inkip": 23.04, "Vag_lb": 4871.0, "Vnet_lb": 1356.0, "Jx1000_in4": 1.054, "Cw_in6": 1.318, "Xo_in": -1.643, "m_in": 0.983, "Ro_in": 2.412, "beta_in": 0.536, "Lu_ft": 42.9},
    "400S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.864, "weight_lbft": 2.94, "Ix_in4": 2.155, "Sx_in3": 1.077, "Rx_in": 1.579, "Iy_in4": 0.462, "Ry_in": 0.731, "Ixe_in4": 2.155, "Sxe_in3": 1.063, "Mal_inkip": 24.72, "Mad_inkip": 25.05, "Vag_lb": 4394.0, "Vnet_lb": 797.0, "Jx1000_in4": 2.978, "Cw_in6": 1.749, "Xo_in": -1.605, "m_in": 0.963, "Ro_in": 2.368, "beta_in": 0.54, "Lu_ft": 49.3},
    "400S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.864, "weight_lbft": 2.94, "Ix_in4": 2.155, "Sx_in3": 1.077, "Rx_in": 1.579, "Iy_in4": 0.462, "Ry_in": 0.731, "Ixe_in4": 2.155, "Sxe_in3": 1.063, "Mal_inkip": 36.68, "Mad_inkip": 37.17, "Vag_lb": 6658.0, "Vnet_lb": 1207.0, "Jx1000_in4": 2.978, "Cw_in6": 1.749, "Xo_in": -1.605, "m_in": 0.963, "Ro_in": 2.368, "beta_in": 0.54, "Lu_ft": 39.9},
    "400S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.447, "weight_lbft": 1.52, "Ix_in4": 1.224, "Sx_in3": 0.612, "Rx_in": 1.655, "Iy_in4": 0.399, "Ry_in": 0.945, "Ixe_in4": 1.224, "Sxe_in3": 0.503, "Mal_inkip": 9.93, "Mad_inkip": 10.41, "Vag_lb": 1739.0, "Vnet_lb": 810.0, "Jx1000_in4": 0.303, "Cw_in6": 1.486, "Xo_in": -2.139, "m_in": 1.252, "Ro_in": 2.864, "beta_in": 0.443, "Lu_ft": 63.7},
    "400S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.556, "weight_lbft": 1.89, "Ix_in4": 1.512, "Sx_in3": 0.756, "Rx_in": 1.649, "Iy_in4": 0.49, "Ry_in": 0.938, "Ixe_in4": 1.512, "Sxe_in3": 0.653, "Mal_inkip": 12.9, "Mad_inkip": 13.91, "Vag_lb": 2603.0, "Vnet_lb": 944.0, "Jx1000_in4": 0.594, "Cw_in6": 1.821, "Xo_in": -2.124, "m_in": 1.244, "Ro_in": 2.848, "beta_in": 0.444, "Lu_ft": 63.8},
    "400S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.556, "weight_lbft": 1.89, "Ix_in4": 1.512, "Sx_in3": 0.756, "Rx_in": 1.649, "Iy_in4": 0.49, "Ry_in": 0.938, "Ixe_in4": 1.506, "Sxe_in3": 0.576, "Mal_inkip": 17.24, "Mad_inkip": 18.42, "Vag_lb": 3372.0, "Vnet_lb": 1223.0, "Jx1000_in4": 0.594, "Cw_in6": 1.821, "Xo_in": -2.124, "m_in": 1.244, "Ro_in": 2.848, "beta_in": 0.444, "Lu_ft": 51.6},
    "400S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.693, "weight_lbft": 2.36, "Ix_in4": 1.864, "Sx_in3": 0.932, "Rx_in": 1.64, "Iy_in4": 0.599, "Ry_in": 0.929, "Ixe_in4": 1.864, "Sxe_in3": 0.883, "Mal_inkip": 17.45, "Mad_inkip": 18.42, "Vag_lb": 3215.0, "Vnet_lb": 895.0, "Jx1000_in4": 1.174, "Cw_in6": 2.225, "Xo_in": -2.105, "m_in": 1.235, "Ro_in": 2.826, "beta_in": 0.445, "Lu_ft": 64.0},
    "400S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.693, "weight_lbft": 2.36, "Ix_in4": 1.864, "Sx_in3": 0.932, "Rx_in": 1.64, "Iy_in4": 0.599, "Ry_in": 0.929, "Ixe_in4": 1.864, "Sxe_in3": 0.775, "Mal_inkip": 23.19, "Mad_inkip": 24.76, "Vag_lb": 4871.0, "Vnet_lb": 1356.0, "Jx1000_in4": 1.174, "Cw_in6": 2.225, "Xo_in": -2.105, "m_in": 1.235, "Ro_in": 2.826, "beta_in": 0.445, "Lu_ft": 51.6},
    "400S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.966, "weight_lbft": 3.29, "Ix_in4": 2.541, "Sx_in3": 1.271, "Rx_in": 1.622, "Iy_in4": 0.801, "Ry_in": 0.911, "Ixe_in4": 2.541, "Sxe_in3": 1.253, "Mal_inkip": 28.31, "Mad_inkip": 28.7, "Vag_lb": 4394.0, "Vnet_lb": 797.0, "Jx1000_in4": 3.329, "Cw_in6": 2.978, "Xo_in": -2.066, "m_in": 1.214, "Ro_in": 2.78, "beta_in": 0.448, "Lu_ft": 60.3},
    "400S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.966, "weight_lbft": 3.29, "Ix_in4": 2.541, "Sx_in3": 1.271, "Rx_in": 1.622, "Iy_in4": 0.801, "Ry_in": 0.911, "Ixe_in4": 2.541, "Sxe_in3": 1.191, "Mal_inkip": 40.06, "Mad_inkip": 41.47, "Vag_lb": 6658.0, "Vnet_lb": 1207.0, "Jx1000_in4": 3.329, "Cw_in6": 2.978, "Xo_in": -2.066, "m_in": 1.214, "Ro_in": 2.78, "beta_in": 0.448, "Lu_ft": 48.8},
    "400S300-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.613, "weight_lbft": 2.09, "Ix_in4": 1.732, "Sx_in3": 0.866, "Rx_in": 1.681, "Iy_in4": 0.76, "Ry_in": 1.114, "Ixe_in4": 1.723, "Sxe_in3": 0.68, "Mal_inkip": 13.44, "Mad_inkip": 14.7, "Vag_lb": 2603.0, "Vnet_lb": 944.0, "Jx1000_in4": 0.655, "Cw_in6": 2.802, "Xo_in": -2.594, "m_in": 1.496, "Ro_in": 3.285, "beta_in": 0.377, "Lu_ft": 74.0},
    "400S300-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.613, "weight_lbft": 2.09, "Ix_in4": 1.732, "Sx_in3": 0.866, "Rx_in": 1.681, "Iy_in4": 0.76, "Ry_in": 1.114, "Ixe_in4": 1.637, "Sxe_in3": 0.592, "Mal_inkip": 17.72, "Mad_inkip": 19.25, "Vag_lb": 3372.0, "Vnet_lb": 1223.0, "Jx1000_in4": 0.655, "Cw_in6": 2.802, "Xo_in": -2.594, "m_in": 1.496, "Ro_in": 3.285, "beta_in": 0.377, "Lu_ft": 59.9},
    "400S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.764, "weight_lbft": 2.6, "Ix_in4": 2.139, "Sx_in3": 1.07, "Rx_in": 1.673, "Iy_in4": 0.933, "Ry_in": 1.105, "Ixe_in4": 2.139, "Sxe_in3": 0.914, "Mal_inkip": 18.06, "Mad_inkip": 19.68, "Vag_lb": 3215.0, "Vnet_lb": 895.0, "Jx1000_in4": 1.295, "Cw_in6": 3.432, "Xo_in": -2.574, "m_in": 1.486, "Ro_in": 3.263, "beta_in": 0.378, "Lu_ft": 74.3},
    "400S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.764, "weight_lbft": 2.6, "Ix_in4": 2.139, "Sx_in3": 1.07, "Rx_in": 1.673, "Iy_in4": 0.933, "Ry_in": 1.105, "Ixe_in4": 2.099, "Sxe_in3": 0.805, "Mal_inkip": 24.09, "Mad_inkip": 26.05, "Vag_lb": 4871.0, "Vnet_lb": 1356.0, "Jx1000_in4": 1.295, "Cw_in6": 3.432, "Xo_in": -2.574, "m_in": 1.486, "Ro_in": 3.263, "beta_in": 0.378, "Lu_ft": 60.0},
    "400S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.067, "weight_lbft": 3.63, "Ix_in4": 2.928, "Sx_in3": 1.464, "Rx_in": 1.656, "Iy_in4": 1.258, "Ry_in": 1.086, "Ixe_in4": 2.928, "Sxe_in3": 1.381, "Mal_inkip": 30.58, "Mad_inkip": 32.4, "Vag_lb": 4394.0, "Vnet_lb": 797.0, "Jx1000_in4": 3.679, "Cw_in6": 4.619, "Xo_in": -2.535, "m_in": 1.465, "Ro_in": 3.216, "beta_in": 0.379, "Lu_ft": 70.8},
    "400S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.067, "weight_lbft": 3.63, "Ix_in4": 2.928, "Sx_in3": 1.464, "Rx_in": 1.656, "Iy_in4": 1.258, "Ry_in": 1.086, "Ixe_in4": 2.897, "Sxe_in3": 1.307, "Mal_inkip": 39.12, "Mad_inkip": 40.72, "Vag_lb": 6658.0, "Vnet_lb": 1207.0, "Jx1000_in4": 3.679, "Cw_in6": 4.619, "Xo_in": -2.535, "m_in": 1.465, "Ro_in": 3.216, "beta_in": 0.379, "Lu_ft": 60.3},
    "550S125-27_33ksi": {"thickness_in": 0.0283, "Fy_ksi": 33.0, "area_in2": 0.229, "weight_lbft": 0.78, "Ix_in4": 0.938, "Sx_in3": 0.341, "Rx_in": 2.023, "Iy_in4": 0.034, "Ry_in": 0.385, "Ixe_in4": 0.898, "Sxe_in3": 0.246, "Mal_inkip": 4.86, "Mad_inkip": 4.26, "Vag_lb": 382.0, "Vnet_lb": 382.0, "Jx1000_in4": 0.061, "Cw_in6": 0.205, "Xo_in": -0.641, "m_in": 0.417, "Ro_in": 2.157, "beta_in": 0.912, "Lu_ft": 27.9},
    "550S125-30_33ksi": {"thickness_in": 0.0312, "Fy_ksi": 33.0, "area_in2": 0.252, "weight_lbft": 0.86, "Ix_in4": 1.031, "Sx_in3": 0.375, "Rx_in": 2.021, "Iy_in4": 0.037, "Ry_in": 0.384, "Ixe_in4": 0.996, "Sxe_in3": 0.286, "Mal_inkip": 5.65, "Mad_inkip": 4.95, "Vag_lb": 512.0, "Vnet_lb": 512.0, "Jx1000_in4": 0.082, "Cw_in6": 0.224, "Xo_in": -0.639, "m_in": 0.415, "Ro_in": 2.154, "beta_in": 0.912, "Lu_ft": 27.9},
    "550S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.279, "weight_lbft": 0.95, "Ix_in4": 1.139, "Sx_in3": 0.414, "Rx_in": 2.019, "Iy_in4": 0.041, "Ry_in": 0.382, "Ixe_in4": 1.111, "Sxe_in3": 0.335, "Mal_inkip": 6.62, "Mad_inkip": 5.78, "Vag_lb": 699.0, "Vnet_lb": 699.0, "Jx1000_in4": 0.112, "Cw_in6": 0.246, "Xo_in": -0.635, "m_in": 0.413, "Ro_in": 2.151, "beta_in": 0.913, "Lu_ft": 27.8},
    "550S125-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.362, "weight_lbft": 1.23, "Ix_in4": 1.468, "Sx_in3": 0.534, "Rx_in": 2.013, "Iy_in4": 0.052, "Ry_in": 0.377, "Ixe_in4": 1.458, "Sxe_in3": 0.5, "Mal_inkip": 9.88, "Mad_inkip": 8.61, "Vag_lb": 1550.0, "Vnet_lb": 1199.0, "Jx1000_in4": 0.246, "Cw_in6": 0.309, "Xo_in": -0.625, "m_in": 0.407, "Ro_in": 2.141, "beta_in": 0.915, "Lu_ft": 27.6},
    "550S125-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.45, "weight_lbft": 1.53, "Ix_in4": 1.805, "Sx_in3": 0.656, "Rx_in": 2.002, "Iy_in4": 0.061, "Ry_in": 0.369, "Ixe_in4": 1.805, "Sxe_in3": 0.647, "Mal_inkip": 12.79, "Mad_inkip": 11.92, "Vag_lb": 2739.0, "Vnet_lb": 1666.0, "Jx1000_in4": 0.481, "Cw_in6": 0.374, "Xo_in": -0.613, "m_in": 0.401, "Ro_in": 2.126, "beta_in": 0.917, "Lu_ft": 27.3},
    "550S125-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.45, "weight_lbft": 1.53, "Ix_in4": 1.805, "Sx_in3": 0.656, "Rx_in": 2.002, "Iy_in4": 0.061, "Ry_in": 0.369, "Ixe_in4": 1.791, "Sxe_in3": 0.606, "Mal_inkip": 18.13, "Mad_inkip": 15.75, "Vag_lb": 3093.0, "Vnet_lb": 1881.0, "Jx1000_in4": 0.481, "Cw_in6": 0.374, "Xo_in": -0.613, "m_in": 0.401, "Ro_in": 2.126, "beta_in": 0.917, "Lu_ft": 22.1},
    "550S125-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.559, "weight_lbft": 1.9, "Ix_in4": 2.209, "Sx_in3": 0.803, "Rx_in": 1.987, "Iy_in4": 0.072, "Ry_in": 0.358, "Ixe_in4": 2.205, "Sxe_in3": 0.801, "Mal_inkip": 18.94, "Mad_inkip": 2.0, "Vag_lb": 18.59, "Vnet_lb": 4347.0, "Jx1000_in4": 2057.0, "Cw_in6": 0.948, "Xo_in": 0.448, "m_in": -0.597, "Ro_in": 0.392, "beta_in": 2.106, "Lu_ft": 0.92},
    "550S125-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.559, "weight_lbft": 1.9, "Ix_in4": 2.209, "Sx_in3": 0.803, "Rx_in": 1.987, "Iy_in4": 0.072, "Ry_in": 0.358, "Ixe_in4": 2.205, "Sxe_in3": 0.791, "Mal_inkip": 23.68, "Mad_inkip": 21.98, "Vag_lb": 5350.0, "Vnet_lb": 2532.0, "Jx1000_in4": 0.948, "Cw_in6": 0.448, "Xo_in": -0.597, "m_in": 0.392, "Ro_in": 2.106, "beta_in": 0.92, "Lu_ft": 21.8},
    "550S137-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.301, "weight_lbft": 1.02, "Ix_in4": 1.283, "Sx_in3": 0.467, "Rx_in": 2.064, "Iy_in4": 0.067, "Ry_in": 0.472, "Ixe_in4": 1.283, "Sxe_in3": 0.453, "Mal_inkip": 8.95, "Mad_inkip": 7.48, "Vag_lb": 699.0, "Vnet_lb": 699.0, "Jx1000_in4": 0.12, "Cw_in6": 0.411, "Xo_in": -0.841, "m_in": 0.536, "Ro_in": 2.278, "beta_in": 0.864, "Lu_ft": 33.7},
    "550S137-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.391, "weight_lbft": 1.33, "Ix_in4": 1.655, "Sx_in3": 0.602, "Rx_in": 2.059, "Iy_in4": 0.085, "Ry_in": 0.467, "Ixe_in4": 1.655, "Sxe_in3": 0.592, "Mal_inkip": 13.08, "Mad_inkip": 11.6, "Vag_lb": 1550.0, "Vnet_lb": 1199.0, "Jx1000_in4": 0.265, "Cw_in6": 0.52, "Xo_in": -0.83, "m_in": 0.53, "Ro_in": 2.268, "beta_in": 0.866, "Lu_ft": 31.7},
    "550S137-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.486, "weight_lbft": 1.65, "Ix_in4": 2.039, "Sx_in3": 0.741, "Rx_in": 2.049, "Iy_in4": 0.103, "Ry_in": 0.46, "Ixe_in4": 2.039, "Sxe_in3": 0.741, "Mal_inkip": 16.77, "Mad_inkip": 15.9, "Vag_lb": 2739.0, "Vnet_lb": 1666.0, "Jx1000_in4": 0.519, "Cw_in6": 0.632, "Xo_in": -0.817, "m_in": 0.523, "Ro_in": 2.254, "beta_in": 0.868, "Lu_ft": 31.1},
    "550S137-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.486, "weight_lbft": 1.65, "Ix_in4": 2.039, "Sx_in3": 0.741, "Rx_in": 2.049, "Iy_in4": 0.103, "Ry_in": 0.46, "Ixe_in4": 2.039, "Sxe_in3": 0.714, "Mal_inkip": 24.03, "Mad_inkip": 20.88, "Vag_lb": 3093.0, "Vnet_lb": 1881.0, "Jx1000_in4": 0.519, "Cw_in6": 0.632, "Xo_in": -0.817, "m_in": 0.523, "Ro_in": 2.254, "beta_in": 0.868, "Lu_ft": 25.4},
    "550S137-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.604, "weight_lbft": 2.05, "Ix_in4": 2.503, "Sx_in3": 0.91, "Rx_in": 2.036, "Iy_in4": 0.123, "Ry_in": 0.451, "Ixe_in4": 2.503, "Sxe_in3": 0.91, "Mal_inkip": 21.22, "Mad_inkip": 21.22, "Vag_lb": 4347.0, "Vnet_lb": 2057.0, "Jx1000_in4": 1.023, "Cw_in6": 0.764, "Xo_in": -0.801, "m_in": 0.514, "Ro_in": 2.234, "beta_in": 0.871, "Lu_ft": 30.4},
    "550S137-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.604, "weight_lbft": 2.05, "Ix_in4": 2.503, "Sx_in3": 0.91, "Rx_in": 2.036, "Iy_in4": 0.123, "Ry_in": 0.451, "Ixe_in4": 2.503, "Sxe_in3": 0.909, "Mal_inkip": 31.42, "Mad_inkip": 28.89, "Vag_lb": 5350.0, "Vnet_lb": 2532.0, "Jx1000_in4": 1.023, "Cw_in6": 0.764, "Xo_in": -0.801, "m_in": 0.514, "Ro_in": 2.234, "beta_in": 0.871, "Lu_ft": 24.9},
    "550S137-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.838, "weight_lbft": 2.85, "Ix_in4": 3.38, "Sx_in3": 1.229, "Rx_in": 2.008, "Iy_in4": 0.155, "Ry_in": 0.43, "Ixe_in4": 3.38, "Sxe_in3": 1.229, "Mal_inkip": 30.35, "Mad_inkip": 30.35, "Vag_lb": 6282.0, "Vnet_lb": 1997.0, "Jx1000_in4": 2.891, "Cw_in6": 0.997, "Xo_in": -0.766, "m_in": 0.497, "Ro_in": 2.192, "beta_in": 0.878, "Lu_ft": 29.2},
    "550S137-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.838, "weight_lbft": 2.85, "Ix_in4": 3.38, "Sx_in3": 1.229, "Rx_in": 2.008, "Iy_in4": 0.155, "Ry_in": 0.43, "Ixe_in4": 3.38, "Sxe_in3": 1.229, "Mal_inkip": 44.72, "Mad_inkip": 44.72, "Vag_lb": 9518.0, "Vnet_lb": 3026.0, "Jx1000_in4": 2.891, "Cw_in6": 0.997, "Xo_in": -0.766, "m_in": 0.497, "Ro_in": 2.192, "beta_in": 0.878, "Lu_ft": 23.9},
    "550S162-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.327, "weight_lbft": 1.11, "Ix_in4": 1.458, "Sx_in3": 0.53, "Rx_in": 2.112, "Iy_in4": 0.113, "Ry_in": 0.589, "Ixe_in4": 1.458, "Sxe_in3": 0.512, "Mal_inkip": 10.11, "Mad_inkip": 8.63, "Vag_lb": 699.0, "Vnet_lb": 699.0, "Jx1000_in4": 0.13, "Cw_in6": 0.713, "Xo_in": -1.114, "m_in": 0.697, "Ro_in": 2.459, "beta_in": 0.795, "Lu_ft": 41.4},
    "550S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.424, "weight_lbft": 1.44, "Ix_in4": 1.883, "Sx_in3": 0.685, "Rx_in": 2.107, "Iy_in4": 0.145, "Ry_in": 0.584, "Ixe_in4": 1.883, "Sxe_in3": 0.681, "Mal_inkip": 14.79, "Mad_inkip": 2.0, "Vag_lb": 13.14, "Vnet_lb": 1550.0, "Jx1000_in4": 1199.0, "Cw_in6": 0.288, "Xo_in": 0.905, "m_in": -1.103, "Ro_in": 0.691, "beta_in": 2.448, "Lu_ft": 0.797},
    "550S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.528, "weight_lbft": 1.8, "Ix_in4": 2.324, "Sx_in3": 0.845, "Rx_in": 2.098, "Iy_in4": 0.176, "Ry_in": 0.577, "Ixe_in4": 2.324, "Sxe_in3": 0.845, "Mal_inkip": 18.76, "Mad_inkip": 2.0, "Vag_lb": 17.87, "Vnet_lb": 2739.0, "Jx1000_in4": 1666.0, "Cw_in6": 0.564, "Xo_in": 1.105, "m_in": -1.09, "Ro_in": 0.684, "beta_in": 2.434, "Lu_ft": 0.8},
    "550S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.528, "weight_lbft": 1.8, "Ix_in4": 2.324, "Sx_in3": 0.845, "Rx_in": 2.098, "Iy_in4": 0.176, "Ry_in": 0.577, "Ixe_in4": 2.324, "Sxe_in3": 0.811, "Mal_inkip": 26.86, "Mad_inkip": 2.0, "Vag_lb": 23.52, "Vnet_lb": 3093.0, "Jx1000_in4": 1881.0, "Cw_in6": 0.564, "Xo_in": 1.105, "m_in": -1.09, "Ro_in": 0.684, "beta_in": 2.434, "Lu_ft": 0.8},
    "550S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.657, "weight_lbft": 2.24, "Ix_in4": 2.861, "Sx_in3": 1.04, "Rx_in": 2.086, "Iy_in4": 0.212, "Ry_in": 0.568, "Ixe_in4": 2.861, "Sxe_in3": 1.04, "Mal_inkip": 23.72, "Mad_inkip": 2.0, "Vag_lb": 23.72, "Vnet_lb": 4347.0, "Jx1000_in4": 2057.0, "Cw_in6": 1.114, "Xo_in": 1.342, "m_in": -1.072, "Ro_in": 0.675, "beta_in": 2.414, "Lu_ft": 0.803},
    "550S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.657, "weight_lbft": 2.24, "Ix_in4": 2.861, "Sx_in3": 1.04, "Rx_in": 2.086, "Iy_in4": 0.212, "Ry_in": 0.568, "Ixe_in4": 2.861, "Sxe_in3": 1.031, "Mal_inkip": 34.94, "Mad_inkip": 2.0, "Vag_lb": 32.28, "Vnet_lb": 5350.0, "Jx1000_in4": 2532.0, "Cw_in6": 1.114, "Xo_in": 1.342, "m_in": -1.072, "Ro_in": 0.675, "beta_in": 2.414, "Lu_ft": 0.803},
    "550S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.915, "weight_lbft": 3.11, "Ix_in4": 3.886, "Sx_in3": 1.413, "Rx_in": 2.061, "Iy_in4": 0.276, "Ry_in": 0.549, "Ixe_in4": 3.886, "Sxe_in3": 1.413, "Mal_inkip": 33.91, "Mad_inkip": 33.91, "Vag_lb": 6282.0, "Vnet_lb": 1997.0, "Jx1000_in4": 3.154, "Cw_in6": 1.775, "Xo_in": -1.037, "m_in": 0.656, "Ro_in": 2.372, "beta_in": 0.809, "Lu_ft": 36.8},
    "550S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.915, "weight_lbft": 3.11, "Ix_in4": 3.886, "Sx_in3": 1.413, "Rx_in": 2.061, "Iy_in4": 0.276, "Ry_in": 0.549, "Ixe_in4": 3.886, "Sxe_in3": 1.413, "Mal_inkip": 50.13, "Mad_inkip": 50.13, "Vag_lb": 9518.0, "Vnet_lb": 3026.0, "Jx1000_in4": 3.154, "Cw_in6": 1.775, "Xo_in": -1.037, "m_in": 0.656, "Ro_in": 2.372, "beta_in": 0.809, "Lu_ft": 30.0},
    "550S200-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.362, "weight_lbft": 1.23, "Ix_in4": 1.694, "Sx_in3": 0.616, "Rx_in": 2.164, "Iy_in4": 0.204, "Ry_in": 0.751, "Ixe_in4": 1.678, "Sxe_in3": 0.559, "Mal_inkip": 11.05, "Mad_inkip": 9.8, "Vag_lb": 699.0, "Vnet_lb": 699.0, "Jx1000_in4": 0.144, "Cw_in6": 1.326, "Xo_in": -1.508, "m_in": 0.925, "Ro_in": 2.742, "beta_in": 0.698, "Lu_ft": 51.9},
    "550S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.469, "weight_lbft": 1.6, "Ix_in4": 2.189, "Sx_in3": 0.796, "Rx_in": 2.159, "Iy_in4": 0.261, "Ry_in": 0.746, "Ixe_in4": 2.189, "Sxe_in3": 0.776, "Mal_inkip": 15.33, "Mad_inkip": 13.96, "Vag_lb": 1550.0, "Vnet_lb": 1199.0, "Jx1000_in4": 0.318, "Cw_in6": 1.691, "Xo_in": -1.496, "m_in": 0.918, "Ro_in": 2.731, "beta_in": 0.7, "Lu_ft": 51.7},
    "550S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.585, "weight_lbft": 1.99, "Ix_in4": 2.706, "Sx_in3": 0.984, "Rx_in": 2.152, "Iy_in4": 0.32, "Ry_in": 0.739, "Ixe_in4": 2.706, "Sxe_in3": 0.984, "Mal_inkip": 21.41, "Mad_inkip": 19.98, "Vag_lb": 2739.0, "Vnet_lb": 1666.0, "Jx1000_in4": 0.624, "Cw_in6": 2.072, "Xo_in": -1.483, "m_in": 0.911, "Ro_in": 2.716, "beta_in": 0.702, "Lu_ft": 49.2},
    "550S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.585, "weight_lbft": 1.99, "Ix_in4": 2.706, "Sx_in3": 0.984, "Rx_in": 2.152, "Iy_in4": 0.32, "Ry_in": 0.739, "Ixe_in4": 2.706, "Sxe_in3": 0.901, "Mal_inkip": 26.98, "Mad_inkip": 24.84, "Vag_lb": 3093.0, "Vnet_lb": 1881.0, "Jx1000_in4": 0.624, "Cw_in6": 2.072, "Xo_in": -1.483, "m_in": 0.911, "Ro_in": 2.716, "beta_in": 0.702, "Lu_ft": 41.8},
    "550S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.729, "weight_lbft": 2.48, "Ix_in4": 3.341, "Sx_in3": 1.215, "Rx_in": 2.141, "Iy_in4": 0.389, "Ry_in": 0.731, "Ixe_in4": 3.341, "Sxe_in3": 1.215, "Mal_inkip": 27.03, "Mad_inkip": 27.03, "Vag_lb": 4347.0, "Vnet_lb": 2057.0, "Jx1000_in4": 1.235, "Cw_in6": 2.531, "Xo_in": -1.465, "m_in": 0.902, "Ro_in": 2.695, "beta_in": 0.705, "Lu_ft": 48.5},
    "550S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.729, "weight_lbft": 2.48, "Ix_in4": 3.341, "Sx_in3": 1.215, "Rx_in": 2.141, "Iy_in4": 0.389, "Ry_in": 0.731, "Ixe_in4": 3.341, "Sxe_in3": 1.17, "Mal_inkip": 38.83, "Mad_inkip": 35.92, "Vag_lb": 5350.0, "Vnet_lb": 2532.0, "Jx1000_in4": 1.235, "Cw_in6": 2.531, "Xo_in": -1.465, "m_in": 0.902, "Ro_in": 2.695, "beta_in": 0.705, "Lu_ft": 39.6},
    "550S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.016, "weight_lbft": 3.46, "Ix_in4": 4.563, "Sx_in3": 1.659, "Rx_in": 2.119, "Iy_in4": 0.515, "Ry_in": 0.712, "Ixe_in4": 4.563, "Sxe_in3": 1.659, "Mal_inkip": 38.58, "Mad_inkip": 38.58, "Vag_lb": 6282.0, "Vnet_lb": 1997.0, "Jx1000_in4": 3.504, "Cw_in6": 3.384, "Xo_in": -1.428, "m_in": 0.882, "Ro_in": 2.652, "beta_in": 0.71, "Lu_ft": 47.4},
    "550S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.016, "weight_lbft": 3.46, "Ix_in4": 4.563, "Sx_in3": 1.659, "Rx_in": 2.119, "Iy_in4": 0.515, "Ry_in": 0.712, "Ixe_in4": 4.563, "Sxe_in3": 1.659, "Mal_inkip": 57.25, "Mad_inkip": 57.25, "Vag_lb": 9518.0, "Vnet_lb": 3026.0, "Jx1000_in4": 3.504, "Cw_in6": 3.384, "Xo_in": -1.428, "m_in": 0.882, "Ro_in": 2.652, "beta_in": 0.71, "Lu_ft": 38.6},
    "550S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.515, "weight_lbft": 1.75, "Ix_in4": 2.524, "Sx_in3": 0.918, "Rx_in": 2.215, "Iy_in4": 0.445, "Ry_in": 0.93, "Ixe_in4": 2.524, "Sxe_in3": 0.817, "Mal_inkip": 16.15, "Mad_inkip": 14.74, "Vag_lb": 1550.0, "Vnet_lb": 1199.0, "Jx1000_in4": 0.349, "Cw_in6": 2.837, "Xo_in": -1.933, "m_in": 1.163, "Ro_in": 3.083, "beta_in": 0.607, "Lu_ft": 62.6},
    "550S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.641, "weight_lbft": 2.18, "Ix_in4": 3.126, "Sx_in3": 1.137, "Rx_in": 2.208, "Iy_in4": 0.547, "Ry_in": 0.923, "Ixe_in4": 3.126, "Sxe_in3": 1.033, "Mal_inkip": 20.4, "Mad_inkip": 19.87, "Vag_lb": 2739.0, "Vnet_lb": 1666.0, "Jx1000_in4": 0.685, "Cw_in6": 3.486, "Xo_in": -1.919, "m_in": 1.155, "Ro_in": 3.067, "beta_in": 0.609, "Lu_ft": 62.6},
    "550S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.641, "weight_lbft": 2.18, "Ix_in4": 3.126, "Sx_in3": 1.137, "Rx_in": 2.208, "Iy_in4": 0.547, "Ry_in": 0.923, "Ixe_in4": 3.084, "Sxe_in3": 0.95, "Mal_inkip": 28.44, "Mad_inkip": 26.11, "Vag_lb": 3093.0, "Vnet_lb": 1881.0, "Jx1000_in4": 0.685, "Cw_in6": 3.486, "Xo_in": -1.919, "m_in": 1.155, "Ro_in": 3.067, "beta_in": 0.609, "Lu_ft": 50.7},
    "550S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.8, "weight_lbft": 2.72, "Ix_in4": 3.866, "Sx_in3": 1.406, "Rx_in": 2.198, "Iy_in4": 0.669, "Ry_in": 0.914, "Ixe_in4": 3.866, "Sxe_in3": 1.345, "Mal_inkip": 29.28, "Mad_inkip": 28.52, "Vag_lb": 4347.0, "Vnet_lb": 2057.0, "Jx1000_in4": 1.356, "Cw_in6": 4.274, "Xo_in": -1.9, "m_in": 1.146, "Ro_in": 3.046, "beta_in": 0.611, "Lu_ft": 59.5},
    "550S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.8, "weight_lbft": 2.72, "Ix_in4": 3.866, "Sx_in3": 1.406, "Rx_in": 2.198, "Iy_in4": 0.669, "Ry_in": 0.914, "Ixe_in4": 3.864, "Sxe_in3": 1.233, "Mal_inkip": 36.91, "Mad_inkip": 35.43, "Vag_lb": 5350.0, "Vnet_lb": 2532.0, "Jx1000_in4": 1.356, "Cw_in6": 4.274, "Xo_in": -1.9, "m_in": 1.146, "Ro_in": 3.046, "beta_in": 0.611, "Lu_ft": 50.6},
    "550S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.118, "weight_lbft": 3.8, "Ix_in4": 5.304, "Sx_in3": 1.929, "Rx_in": 2.178, "Iy_in4": 0.897, "Ry_in": 0.895, "Ixe_in4": 5.304, "Sxe_in3": 1.925, "Mal_inkip": 43.47, "Mad_inkip": 43.57, "Vag_lb": 6282.0, "Vnet_lb": 1997.0, "Jx1000_in4": 3.855, "Cw_in6": 5.761, "Xo_in": -1.862, "m_in": 1.126, "Ro_in": 3.002, "beta_in": 0.615, "Lu_ft": 58.4},
    "550S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.118, "weight_lbft": 3.8, "Ix_in4": 5.304, "Sx_in3": 1.929, "Rx_in": 2.178, "Iy_in4": 0.897, "Ry_in": 0.895, "Ixe_in4": 5.304, "Sxe_in3": 1.837, "Mal_inkip": 61.77, "Mad_inkip": 60.32, "Vag_lb": 9518.0, "Vnet_lb": 3026.0, "Jx1000_in4": 3.855, "Cw_in6": 5.761, "Xo_in": -1.862, "m_in": 1.126, "Ro_in": 3.002, "beta_in": 0.615, "Lu_ft": 47.6},
    "600S125-27_33ksi": {"thickness_in": 0.0283, "Fy_ksi": 33.0, "area_in2": 0.243, "weight_lbft": 0.83, "Ix_in4": 1.16, "Sx_in3": 0.387, "Rx_in": 2.183, "Iy_in4": 0.035, "Ry_in": 0.377, "Ixe_in4": 1.097, "Sxe_in3": 0.271, "Mal_inkip": 5.35, "Mad_inkip": 4.63, "Vag_lb": 349.0, "Vnet_lb": 349.0, "Jx1000_in4": 0.065, "Cw_in6": 0.251, "Xo_in": -0.614, "m_in": 0.402, "Ro_in": 2.299, "beta_in": 0.929, "Lu_ft": 27.7},
    "600S125-30_33ksi": {"thickness_in": 0.0312, "Fy_ksi": 33.0, "area_in2": 0.268, "weight_lbft": 0.91, "Ix_in4": 1.275, "Sx_in3": 0.425, "Rx_in": 2.181, "Iy_in4": 0.038, "Ry_in": 0.376, "Ixe_in4": 1.218, "Sxe_in3": 0.315, "Mal_inkip": 6.22, "Mad_inkip": 5.39, "Vag_lb": 468.0, "Vnet_lb": 468.0, "Jx1000_in4": 0.087, "Cw_in6": 0.274, "Xo_in": -0.611, "m_in": 0.401, "Ro_in": 2.296, "beta_in": 0.929, "Lu_ft": 27.6},
    "600S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.297, "weight_lbft": 1.01, "Ix_in4": 1.409, "Sx_in3": 0.47, "Rx_in": 2.179, "Iy_in4": 0.042, "Ry_in": 0.374, "Ixe_in4": 1.361, "Sxe_in3": 0.369, "Mal_inkip": 7.3, "Mad_inkip": 6.32, "Vag_lb": 638.0, "Vnet_lb": 638.0, "Jx1000_in4": 0.118, "Cw_in6": 0.3, "Xo_in": -0.608, "m_in": 0.399, "Ro_in": 2.293, "beta_in": 0.93, "Lu_ft": 27.6},
    "600S125-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.385, "weight_lbft": 1.31, "Ix_in4": 1.817, "Sx_in3": 0.606, "Rx_in": 2.173, "Iy_in4": 0.053, "Ry_in": 0.369, "Ixe_in4": 1.807, "Sxe_in3": 0.555, "Mal_inkip": 10.96, "Mad_inkip": 9.46, "Vag_lb": 1416.0, "Vnet_lb": 1240.0, "Jx1000_in4": 0.261, "Cw_in6": 0.378, "Xo_in": -0.598, "m_in": 0.393, "Ro_in": 2.284, "beta_in": 0.931, "Lu_ft": 27.3},
    "600S125-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.479, "weight_lbft": 1.63, "Ix_in4": 2.236, "Sx_in3": 0.745, "Rx_in": 2.161, "Iy_in4": 0.063, "Ry_in": 0.362, "Ixe_in4": 2.236, "Sxe_in3": 0.727, "Mal_inkip": 14.37, "Mad_inkip": 13.18, "Vag_lb": 2739.0, "Vnet_lb": 1890.0, "Jx1000_in4": 0.511, "Cw_in6": 0.457, "Xo_in": -0.586, "m_in": 0.386, "Ro_in": 2.269, "beta_in": 0.933, "Lu_ft": 27.1},
    "600S125-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.479, "weight_lbft": 1.63, "Ix_in4": 2.236, "Sx_in3": 0.745, "Rx_in": 2.161, "Iy_in4": 0.063, "Ry_in": 0.362, "Ixe_in4": 2.22, "Sxe_in3": 0.673, "Mal_inkip": 20.15, "Mad_inkip": 17.34, "Vag_lb": 2823.0, "Vnet_lb": 1947.0, "Jx1000_in4": 0.511, "Cw_in6": 0.457, "Xo_in": -0.586, "m_in": 0.386, "Ro_in": 2.269, "beta_in": 0.933, "Lu_ft": 21.9},
    "600S125-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.595, "weight_lbft": 2.02, "Ix_in4": 2.74, "Sx_in3": 0.913, "Rx_in": 2.146, "Iy_in4": 0.073, "Ry_in": 0.351, "Ixe_in4": 2.735, "Sxe_in3": 0.911, "Mal_inkip": 21.53, "Mad_inkip": 2.0, "Vag_lb": 20.65, "Vnet_lb": 4347.0, "Jx1000_in4": 2339.0, "Cw_in6": 1.008, "Xo_in": 0.548, "m_in": -0.57, "Ro_in": 0.378, "beta_in": 2.248, "Lu_ft": 0.936},
    "600S125-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.595, "weight_lbft": 2.02, "Ix_in4": 2.74, "Sx_in3": 0.913, "Rx_in": 2.146, "Iy_in4": 0.073, "Ry_in": 0.351, "Ixe_in4": 2.735, "Sxe_in3": 0.898, "Mal_inkip": 26.88, "Mad_inkip": 24.34, "Vag_lb": 5350.0, "Vnet_lb": 2879.0, "Jx1000_in4": 1.008, "Cw_in6": 0.548, "Xo_in": -0.57, "m_in": 0.378, "Ro_in": 2.248, "beta_in": 0.936, "Lu_ft": 21.6},
    "600S137-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.318, "weight_lbft": 1.08, "Ix_in4": 1.582, "Sx_in3": 0.527, "Rx_in": 2.229, "Iy_in4": 0.069, "Ry_in": 0.464, "Ixe_in4": 1.548, "Sxe_in3": 0.455, "Mal_inkip": 8.98, "Mad_inkip": 8.19, "Vag_lb": 638.0, "Vnet_lb": 638.0, "Jx1000_in4": 0.127, "Cw_in6": 0.5, "Xo_in": -0.807, "m_in": 0.519, "Ro_in": 2.416, "beta_in": 0.889, "Lu_ft": 33.5},
    "600S137-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.413, "weight_lbft": 1.41, "Ix_in4": 2.042, "Sx_in3": 0.681, "Rx_in": 2.223, "Iy_in4": 0.087, "Ry_in": 0.459, "Ixe_in4": 2.041, "Sxe_in3": 0.645, "Mal_inkip": 12.74, "Mad_inkip": 11.82, "Vag_lb": 1416.0, "Vnet_lb": 1240.0, "Jx1000_in4": 0.28, "Cw_in6": 0.633, "Xo_in": -0.796, "m_in": 0.513, "Ro_in": 2.406, "beta_in": 0.89, "Lu_ft": 33.3},
    "600S137-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.514, "weight_lbft": 1.75, "Ix_in4": 2.518, "Sx_in3": 0.839, "Rx_in": 2.213, "Iy_in4": 0.105, "Ry_in": 0.452, "Ixe_in4": 2.518, "Sxe_in3": 0.832, "Mal_inkip": 16.44, "Mad_inkip": 15.95, "Vag_lb": 2739.0, "Vnet_lb": 1890.0, "Jx1000_in4": 0.549, "Cw_in6": 0.769, "Xo_in": -0.784, "m_in": 0.506, "Ro_in": 2.391, "beta_in": 0.893, "Lu_ft": 33.0},
    "600S137-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.514, "weight_lbft": 1.75, "Ix_in4": 2.518, "Sx_in3": 0.839, "Rx_in": 2.213, "Iy_in4": 0.105, "Ry_in": 0.452, "Ixe_in4": 2.518, "Sxe_in3": 0.777, "Mal_inkip": 23.26, "Mad_inkip": 21.24, "Vag_lb": 2823.0, "Vnet_lb": 1947.0, "Jx1000_in4": 0.549, "Cw_in6": 0.769, "Xo_in": -0.784, "m_in": 0.506, "Ro_in": 2.391, "beta_in": 0.893, "Lu_ft": 26.8},
    "600S137-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.64, "weight_lbft": 2.18, "Ix_in4": 3.094, "Sx_in3": 1.031, "Rx_in": 2.2, "Iy_in4": 0.125, "Ry_in": 0.443, "Ixe_in4": 3.094, "Sxe_in3": 1.031, "Mal_inkip": 24.05, "Mad_inkip": 2.0, "Vag_lb": 24.05, "Vnet_lb": 4347.0, "Jx1000_in4": 2339.0, "Cw_in6": 1.084, "Xo_in": 0.93, "m_in": -0.768, "Ro_in": 0.497, "beta_in": 2.371, "Lu_ft": 0.895},
    "600S137-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.64, "weight_lbft": 2.18, "Ix_in4": 3.094, "Sx_in3": 1.031, "Rx_in": 2.2, "Iy_in4": 0.125, "Ry_in": 0.443, "Ixe_in4": 3.094, "Sxe_in3": 1.03, "Mal_inkip": 30.84, "Mad_inkip": 28.89, "Vag_lb": 5350.0, "Vnet_lb": 2879.0, "Jx1000_in4": 1.084, "Cw_in6": 0.93, "Xo_in": -0.768, "m_in": 0.497, "Ro_in": 2.371, "beta_in": 0.895, "Lu_ft": 26.5},
    "600S137-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.889, "weight_lbft": 3.03, "Ix_in4": 4.188, "Sx_in3": 1.396, "Rx_in": 2.17, "Iy_in4": 0.159, "Ry_in": 0.422, "Ixe_in4": 4.188, "Sxe_in3": 1.396, "Mal_inkip": 34.48, "Mad_inkip": 2.0, "Vag_lb": 34.49, "Vnet_lb": 6911.0, "Jx1000_in4": 2512.0, "Cw_in6": 3.066, "Xo_in": 1.216, "m_in": -0.734, "Ro_in": 0.48, "beta_in": 2.33, "Lu_ft": 0.901},
    "600S137-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.889, "weight_lbft": 3.03, "Ix_in4": 4.188, "Sx_in3": 1.396, "Rx_in": 2.17, "Iy_in4": 0.159, "Ry_in": 0.422, "Ixe_in4": 4.188, "Sxe_in3": 1.396, "Mal_inkip": 50.8, "Mad_inkip": 2.0, "Vag_lb": 50.8, "Vnet_lb": 10472.0, "Jx1000_in4": 3805.0, "Cw_in6": 3.066, "Xo_in": 1.216, "m_in": -0.734, "Ro_in": 0.48, "beta_in": 2.33, "Lu_ft": 0.901},
    "600S137-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.065, "weight_lbft": 3.62, "Ix_in4": 4.913, "Sx_in3": 1.638, "Rx_in": 2.147, "Iy_in4": 0.176, "Ry_in": 0.406, "Ixe_in4": 4.913, "Sxe_in3": 1.638, "Mal_inkip": 42.05, "Mad_inkip": 42.05, "Vag_lb": 8267.0, "Vnet_lb": 2391.0, "Jx1000_in4": 5.477, "Cw_in6": 1.391, "Xo_in": -0.709, "m_in": 0.467, "Ro_in": 2.298, "beta_in": 0.905, "Lu_ft": 27.9},
    "600S137-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.065, "weight_lbft": 3.62, "Ix_in4": 4.913, "Sx_in3": 1.638, "Rx_in": 2.147, "Iy_in4": 0.176, "Ry_in": 0.406, "Ixe_in4": 4.913, "Sxe_in3": 1.638, "Mal_inkip": 61.69, "Mad_inkip": 61.69, "Vag_lb": 12526.0, "Vnet_lb": 3622.0, "Jx1000_in4": 5.477, "Cw_in6": 1.391, "Xo_in": -0.709, "m_in": 0.467, "Ro_in": 2.298, "beta_in": 0.905, "Lu_ft": 22.9},
    "600S162-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.344, "weight_lbft": 1.17, "Ix_in4": 1.793, "Sx_in3": 0.598, "Rx_in": 2.282, "Iy_in4": 0.116, "Ry_in": 0.581, "Ixe_in4": 1.793, "Sxe_in3": 0.577, "Mal_inkip": 11.41, "Mad_inkip": 9.47, "Vag_lb": 638.0, "Vnet_lb": 638.0, "Jx1000_in4": 0.137, "Cw_in6": 0.861, "Xo_in": -1.072, "m_in": 0.677, "Ro_in": 2.587, "beta_in": 0.828, "Lu_ft": 41.1},
    "600S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.447, "weight_lbft": 1.52, "Ix_in4": 2.316, "Sx_in3": 0.772, "Rx_in": 2.276, "Iy_in4": 0.148, "Ry_in": 0.576, "Ixe_in4": 2.316, "Sxe_in3": 0.767, "Mal_inkip": 16.68, "Mad_inkip": 2.0, "Vag_lb": 14.46, "Vnet_lb": 1416.0, "Jx1000_in4": 1240.0, "Cw_in6": 0.303, "Xo_in": 1.095, "m_in": -1.062, "Ro_in": 0.67, "beta_in": 2.577, "Lu_ft": 0.83},
    "600S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.556, "weight_lbft": 1.89, "Ix_in4": 2.86, "Sx_in3": 0.953, "Rx_in": 2.267, "Iy_in4": 0.18, "Ry_in": 0.57, "Ixe_in4": 2.86, "Sxe_in3": 0.953, "Mal_inkip": 21.17, "Mad_inkip": 2.0, "Vag_lb": 19.75, "Vnet_lb": 2739.0, "Jx1000_in4": 1890.0, "Cw_in6": 0.594, "Xo_in": 1.337, "m_in": -1.049, "Ro_in": 0.663, "beta_in": 2.562, "Lu_ft": 0.832},
    "600S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.556, "weight_lbft": 1.89, "Ix_in4": 2.86, "Sx_in3": 0.953, "Rx_in": 2.267, "Iy_in4": 0.18, "Ry_in": 0.57, "Ixe_in4": 2.86, "Sxe_in3": 0.916, "Mal_inkip": 30.33, "Mad_inkip": 2.0, "Vag_lb": 25.9, "Vnet_lb": 2823.0, "Jx1000_in4": 1947.0, "Cw_in6": 0.594, "Xo_in": 1.337, "m_in": -1.049, "Ro_in": 0.663, "beta_in": 2.562, "Lu_ft": 0.832},
    "600S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.693, "weight_lbft": 2.36, "Ix_in4": 3.525, "Sx_in3": 1.175, "Rx_in": 2.255, "Iy_in4": 0.218, "Ry_in": 0.56, "Ixe_in4": 3.525, "Sxe_in3": 1.175, "Mal_inkip": 26.79, "Mad_inkip": 2.0, "Vag_lb": 26.78, "Vnet_lb": 4347.0, "Jx1000_in4": 2339.0, "Cw_in6": 1.174, "Xo_in": 1.626, "m_in": -1.032, "Ro_in": 0.655, "beta_in": 2.543, "Lu_ft": 0.835},
    "600S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.693, "weight_lbft": 2.36, "Ix_in4": 3.525, "Sx_in3": 1.175, "Rx_in": 2.255, "Iy_in4": 0.218, "Ry_in": 0.56, "Ixe_in4": 3.525, "Sxe_in3": 1.164, "Mal_inkip": 39.47, "Mad_inkip": 2.0, "Vag_lb": 35.69, "Vnet_lb": 5350.0, "Jx1000_in4": 2879.0, "Cw_in6": 1.174, "Xo_in": 1.626, "m_in": -1.032, "Ro_in": 0.655, "beta_in": 2.543, "Lu_ft": 0.835},
    "600S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 0.966, "weight_lbft": 3.29, "Ix_in4": 4.797, "Sx_in3": 1.599, "Rx_in": 2.229, "Iy_in4": 0.283, "Ry_in": 0.541, "Ixe_in4": 4.797, "Sxe_in3": 1.599, "Mal_inkip": 38.37, "Mad_inkip": 2.0, "Vag_lb": 38.37, "Vnet_lb": 6911.0, "Jx1000_in4": 2512.0, "Cw_in6": 3.329, "Xo_in": 2.153, "m_in": -0.997, "Ro_in": 0.636, "beta_in": 2.501, "Lu_ft": 0.841},
    "600S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 0.966, "weight_lbft": 3.29, "Ix_in4": 4.797, "Sx_in3": 1.599, "Rx_in": 2.229, "Iy_in4": 0.283, "Ry_in": 0.541, "Ixe_in4": 4.797, "Sxe_in3": 1.599, "Mal_inkip": 56.73, "Mad_inkip": 2.0, "Vag_lb": 56.72, "Vnet_lb": 10472.0, "Jx1000_in4": 3805.0, "Cw_in6": 3.329, "Xo_in": 2.153, "m_in": -0.997, "Ro_in": 0.636, "beta_in": 2.501, "Lu_ft": 0.841},
    "600S162-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.158, "weight_lbft": 3.94, "Ix_in4": 5.652, "Sx_in3": 1.884, "Rx_in": 2.209, "Iy_in4": 0.321, "Ry_in": 0.526, "Ixe_in4": 5.652, "Sxe_in3": 1.884, "Mal_inkip": 46.82, "Mad_inkip": 2.0, "Vag_lb": 46.82, "Vnet_lb": 8267.0, "Jx1000_in4": 2391.0, "Cw_in6": 5.956, "Xo_in": 2.487, "m_in": -0.971, "Ro_in": 0.623, "beta_in": 2.47, "Lu_ft": 0.845},
    "600S162-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.158, "weight_lbft": 3.94, "Ix_in4": 5.652, "Sx_in3": 1.884, "Rx_in": 2.209, "Iy_in4": 0.321, "Ry_in": 0.526, "Ixe_in4": 5.652, "Sxe_in3": 1.884, "Mal_inkip": 68.94, "Mad_inkip": 2.0, "Vag_lb": 68.93, "Vnet_lb": 12526.0, "Jx1000_in4": 3622.0, "Cw_in6": 5.956, "Xo_in": 2.487, "m_in": -0.971, "Ro_in": 0.623, "beta_in": 2.47, "Lu_ft": 0.845},
    "600S200-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.379, "weight_lbft": 1.29, "Ix_in4": 2.075, "Sx_in3": 0.692, "Rx_in": 2.34, "Iy_in4": 0.209, "Ry_in": 0.743, "Ixe_in4": 2.058, "Sxe_in3": 0.621, "Mal_inkip": 12.28, "Mad_inkip": 10.77, "Vag_lb": 638.0, "Vnet_lb": 638.0, "Jx1000_in4": 0.151, "Cw_in6": 1.593, "Xo_in": -1.457, "m_in": 0.901, "Ro_in": 2.855, "beta_in": 0.74, "Lu_ft": 51.6},
    "600S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.492, "weight_lbft": 1.67, "Ix_in4": 2.683, "Sx_in3": 0.894, "Rx_in": 2.335, "Iy_in4": 0.268, "Ry_in": 0.739, "Ixe_in4": 2.683, "Sxe_in3": 0.873, "Mal_inkip": 17.24, "Mad_inkip": 15.39, "Vag_lb": 1416.0, "Vnet_lb": 1240.0, "Jx1000_in4": 0.334, "Cw_in6": 2.033, "Xo_in": -1.446, "m_in": 0.894, "Ro_in": 2.844, "beta_in": 0.742, "Lu_ft": 51.4},
    "600S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.613, "weight_lbft": 2.09, "Ix_in4": 3.319, "Sx_in3": 1.106, "Rx_in": 2.327, "Iy_in4": 0.328, "Ry_in": 0.732, "Ixe_in4": 3.319, "Sxe_in3": 1.106, "Mal_inkip": 24.07, "Mad_inkip": 2.0, "Vag_lb": 22.07, "Vnet_lb": 2739.0, "Jx1000_in4": 1890.0, "Cw_in6": 0.655, "Xo_in": 2.493, "m_in": -1.432, "Ro_in": 0.887, "beta_in": 2.829, "Lu_ft": 0.744},
    "600S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.613, "weight_lbft": 2.09, "Ix_in4": 3.319, "Sx_in3": 1.106, "Rx_in": 2.327, "Iy_in4": 0.328, "Ry_in": 0.732, "Ixe_in4": 3.319, "Sxe_in3": 1.015, "Mal_inkip": 30.4, "Mad_inkip": 27.38, "Vag_lb": 2823.0, "Vnet_lb": 1947.0, "Jx1000_in4": 0.655, "Cw_in6": 2.493, "Xo_in": -1.432, "m_in": 0.887, "Ro_in": 2.829, "beta_in": 0.744, "Lu_ft": 41.6},
    "600S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.764, "weight_lbft": 2.6, "Ix_in4": 4.101, "Sx_in3": 1.367, "Rx_in": 2.316, "Iy_in4": 0.4, "Ry_in": 0.723, "Ixe_in4": 4.101, "Sxe_in3": 1.367, "Mal_inkip": 30.42, "Mad_inkip": 2.0, "Vag_lb": 29.97, "Vnet_lb": 4347.0, "Jx1000_in4": 2339.0, "Cw_in6": 1.295, "Xo_in": 3.047, "m_in": -1.415, "Ro_in": 0.878, "beta_in": 2.809, "Lu_ft": 0.746},
    "600S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.764, "weight_lbft": 2.6, "Ix_in4": 4.101, "Sx_in3": 1.367, "Rx_in": 2.316, "Iy_in4": 0.4, "Ry_in": 0.723, "Ixe_in4": 4.101, "Sxe_in3": 1.317, "Mal_inkip": 43.71, "Mad_inkip": 2.0, "Vag_lb": 39.69, "Vnet_lb": 5350.0, "Jx1000_in4": 2879.0, "Cw_in6": 1.295, "Xo_in": 3.047, "m_in": -1.415, "Ro_in": 0.878, "beta_in": 2.809, "Lu_ft": 0.746},
    "600S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.067, "weight_lbft": 3.63, "Ix_in4": 5.612, "Sx_in3": 1.871, "Rx_in": 2.293, "Iy_in4": 0.53, "Ry_in": 0.705, "Ixe_in4": 5.612, "Sxe_in3": 1.871, "Mal_inkip": 43.49, "Mad_inkip": 2.0, "Vag_lb": 43.49, "Vnet_lb": 6911.0, "Jx1000_in4": 2512.0, "Cw_in6": 3.679, "Xo_in": 4.08, "m_in": -1.378, "Ro_in": 0.859, "beta_in": 2.767, "Lu_ft": 0.752},
    "600S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.067, "weight_lbft": 3.63, "Ix_in4": 5.612, "Sx_in3": 1.871, "Rx_in": 2.293, "Iy_in4": 0.53, "Ry_in": 0.705, "Ixe_in4": 5.612, "Sxe_in3": 1.871, "Mal_inkip": 64.53, "Mad_inkip": 2.0, "Vag_lb": 63.67, "Vnet_lb": 10472.0, "Jx1000_in4": 3805.0, "Cw_in6": 3.679, "Xo_in": 4.08, "m_in": -1.378, "Ro_in": 0.859, "beta_in": 2.767, "Lu_ft": 0.752},
    "600S200-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.283, "weight_lbft": 4.36, "Ix_in4": 6.641, "Sx_in3": 2.214, "Rx_in": 2.275, "Iy_in4": 0.611, "Ry_in": 0.69, "Ixe_in4": 6.641, "Sxe_in3": 2.214, "Mal_inkip": 53.05, "Mad_inkip": 2.0, "Vag_lb": 53.05, "Vnet_lb": 8267.0, "Jx1000_in4": 2391.0, "Cw_in6": 6.595, "Xo_in": 4.753, "m_in": -1.351, "Ro_in": 0.845, "beta_in": 2.735, "Lu_ft": 0.756},
    "600S200-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.283, "weight_lbft": 4.36, "Ix_in4": 6.641, "Sx_in3": 2.214, "Rx_in": 2.275, "Iy_in4": 0.611, "Ry_in": 0.69, "Ixe_in4": 6.641, "Sxe_in3": 2.214, "Mal_inkip": 78.44, "Mad_inkip": 2.0, "Vag_lb": 78.44, "Vnet_lb": 12526.0, "Jx1000_in4": 3622.0, "Cw_in6": 6.595, "Xo_in": 4.753, "m_in": -1.351, "Ro_in": 0.845, "beta_in": 2.735, "Lu_ft": 0.756},
    "600S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.537, "weight_lbft": 1.83, "Ix_in4": 3.082, "Sx_in3": 1.027, "Rx_in": 2.396, "Iy_in4": 0.458, "Ry_in": 0.923, "Ixe_in4": 3.082, "Sxe_in3": 0.918, "Mal_inkip": 18.14, "Mad_inkip": 16.21, "Vag_lb": 1416.0, "Vnet_lb": 1240.0, "Jx1000_in4": 0.364, "Cw_in6": 3.411, "Xo_in": -1.874, "m_in": 1.136, "Ro_in": 3.179, "beta_in": 0.652, "Lu_ft": 62.4},
    "600S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.67, "weight_lbft": 2.28, "Ix_in4": 3.819, "Sx_in3": 1.273, "Rx_in": 2.388, "Iy_in4": 0.562, "Ry_in": 0.917, "Ixe_in4": 3.819, "Sxe_in3": 1.159, "Mal_inkip": 22.9, "Mad_inkip": 21.9, "Vag_lb": 2739.0, "Vnet_lb": 1890.0, "Jx1000_in4": 0.715, "Cw_in6": 4.194, "Xo_in": -1.86, "m_in": 1.129, "Ro_in": 3.163, "beta_in": 0.654, "Lu_ft": 62.3},
    "600S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.67, "weight_lbft": 2.28, "Ix_in4": 3.819, "Sx_in3": 1.273, "Rx_in": 2.388, "Iy_in4": 0.562, "Ry_in": 0.917, "Ixe_in4": 3.766, "Sxe_in3": 1.069, "Mal_inkip": 32.0, "Mad_inkip": 28.71, "Vag_lb": 2823.0, "Vnet_lb": 1947.0, "Jx1000_in4": 0.715, "Cw_in6": 4.194, "Xo_in": -1.86, "m_in": 1.129, "Ro_in": 3.163, "beta_in": 0.654, "Lu_ft": 50.5},
    "600S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.836, "weight_lbft": 2.84, "Ix_in4": 4.727, "Sx_in3": 1.576, "Rx_in": 2.378, "Iy_in4": 0.688, "Ry_in": 0.908, "Ixe_in4": 4.727, "Sxe_in3": 1.508, "Mal_inkip": 32.82, "Mad_inkip": 2.0, "Vag_lb": 31.5, "Vnet_lb": 4347.0, "Jx1000_in4": 2339.0, "Cw_in6": 1.416, "Xo_in": 5.145, "m_in": -1.842, "Ro_in": 1.119, "beta_in": 3.142, "Lu_ft": 0.656},
    "600S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.836, "weight_lbft": 2.84, "Ix_in4": 4.727, "Sx_in3": 1.576, "Rx_in": 2.378, "Iy_in4": 0.688, "Ry_in": 0.908, "Ixe_in4": 4.723, "Sxe_in3": 1.386, "Mal_inkip": 41.49, "Mad_inkip": 39.07, "Vag_lb": 5350.0, "Vnet_lb": 2879.0, "Jx1000_in4": 1.416, "Cw_in6": 5.145, "Xo_in": -1.842, "m_in": 1.119, "Ro_in": 3.142, "beta_in": 0.656, "Lu_ft": 50.4},
    "600S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.169, "weight_lbft": 3.98, "Ix_in4": 6.496, "Sx_in3": 2.165, "Rx_in": 2.357, "Iy_in4": 0.923, "Ry_in": 0.889, "Ixe_in4": 6.496, "Sxe_in3": 2.161, "Mal_inkip": 48.81, "Mad_inkip": 2.0, "Vag_lb": 48.91, "Vnet_lb": 6911.0, "Jx1000_in4": 2512.0, "Cw_in6": 4.03, "Xo_in": 6.947, "m_in": -1.803, "Ro_in": 1.1, "beta_in": 3.098, "Lu_ft": 0.661},
    "600S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.169, "weight_lbft": 3.98, "Ix_in4": 6.496, "Sx_in3": 2.165, "Rx_in": 2.357, "Iy_in4": 0.923, "Ry_in": 0.889, "Ixe_in4": 6.496, "Sxe_in3": 2.063, "Mal_inkip": 69.38, "Mad_inkip": 2.0, "Vag_lb": 66.81, "Vnet_lb": 10472.0, "Jx1000_in4": 3805.0, "Cw_in6": 4.03, "Xo_in": 6.947, "m_in": -1.803, "Ro_in": 1.1, "beta_in": 3.098, "Lu_ft": 0.661},
    "600S250-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.407, "weight_lbft": 4.79, "Ix_in4": 7.713, "Sx_in3": 2.571, "Rx_in": 2.342, "Iy_in4": 1.075, "Ry_in": 0.874, "Ixe_in4": 7.713, "Sxe_in3": 2.571, "Mal_inkip": 59.58, "Mad_inkip": 2.0, "Vag_lb": 59.59, "Vnet_lb": 8267.0, "Jx1000_in4": 2391.0, "Cw_in6": 7.234, "Xo_in": 8.142, "m_in": -1.775, "Ro_in": 1.085, "beta_in": 3.066, "Lu_ft": 0.665},
    "600S250-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.407, "weight_lbft": 4.79, "Ix_in4": 7.713, "Sx_in3": 2.571, "Rx_in": 2.342, "Iy_in4": 1.075, "Ry_in": 0.874, "Ixe_in4": 7.713, "Sxe_in3": 2.498, "Mal_inkip": 85.92, "Mad_inkip": 2.0, "Vag_lb": 86.83, "Vnet_lb": 12526.0, "Jx1000_in4": 3622.0, "Cw_in6": 7.234, "Xo_in": 8.142, "m_in": -1.775, "Ro_in": 1.085, "beta_in": 3.066, "Lu_ft": 0.665},
    "600S300-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.726, "weight_lbft": 2.47, "Ix_in4": 4.319, "Sx_in3": 1.44, "Rx_in": 2.439, "Iy_in4": 0.875, "Ry_in": 1.098, "Ixe_in4": 4.269, "Sxe_in3": 1.211, "Mal_inkip": 23.93, "Mad_inkip": 22.8, "Vag_lb": 2739.0, "Vnet_lb": 1890.0, "Jx1000_in4": 0.775, "Cw_in6": 6.452, "Xo_in": -2.299, "m_in": 1.372, "Ro_in": 3.527, "beta_in": 0.575, "Lu_ft": 72.8},
    "600S300-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.726, "weight_lbft": 2.47, "Ix_in4": 4.319, "Sx_in3": 1.44, "Rx_in": 2.439, "Iy_in4": 0.875, "Ry_in": 1.098, "Ixe_in4": 4.014, "Sxe_in3": 1.106, "Mal_inkip": 33.13, "Mad_inkip": 29.62, "Vag_lb": 2823.0, "Vnet_lb": 1947.0, "Jx1000_in4": 0.775, "Cw_in6": 6.452, "Xo_in": -2.299, "m_in": 1.372, "Ro_in": 3.527, "beta_in": 0.575, "Lu_ft": 59.1},
    "600S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.907, "weight_lbft": 3.09, "Ix_in4": 5.354, "Sx_in3": 1.785, "Rx_in": 2.43, "Iy_in4": 1.075, "Ry_in": 1.089, "Ixe_in4": 5.344, "Sxe_in3": 1.581, "Mal_inkip": 31.23, "Mad_inkip": 30.88, "Vag_lb": 4347.0, "Vnet_lb": 2339.0, "Jx1000_in4": 1.537, "Cw_in6": 7.937, "Xo_in": -2.28, "m_in": 1.363, "Ro_in": 3.505, "beta_in": 0.577, "Lu_ft": 72.8},
    "600S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.907, "weight_lbft": 3.09, "Ix_in4": 5.354, "Sx_in3": 1.785, "Rx_in": 2.43, "Iy_in4": 1.075, "Ry_in": 1.089, "Ixe_in4": 5.221, "Sxe_in3": 1.446, "Mal_inkip": 43.3, "Mad_inkip": 40.53, "Vag_lb": 5350.0, "Vnet_lb": 2879.0, "Jx1000_in4": 1.537, "Cw_in6": 7.937, "Xo_in": -2.28, "m_in": 1.363, "Ro_in": 3.505, "beta_in": 0.577, "Lu_ft": 59.0},
    "600S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.271, "weight_lbft": 4.32, "Ix_in4": 7.381, "Sx_in3": 2.46, "Rx_in": 2.41, "Iy_in4": 1.454, "Ry_in": 1.07, "Ixe_in4": 7.381, "Sxe_in3": 2.352, "Mal_inkip": 52.07, "Mad_inkip": 2.0, "Vag_lb": 52.4, "Vnet_lb": 6911.0, "Jx1000_in4": 2512.0, "Cw_in6": 4.381, "Xo_in": 10.776, "m_in": -2.241, "Ro_in": 1.343, "beta_in": 3.461, "Lu_ft": 0.581},
    "600S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.271, "weight_lbft": 4.32, "Ix_in4": 7.381, "Sx_in3": 2.46, "Rx_in": 2.41, "Iy_in4": 1.454, "Ry_in": 1.07, "Ixe_in4": 7.28, "Sxe_in3": 2.247, "Mal_inkip": 67.28, "Mad_inkip": 64.67, "Vag_lb": 10472.0, "Vnet_lb": 3805.0, "Jx1000_in4": 4.381, "Cw_in6": 10.776, "Xo_in": -2.241, "m_in": 1.343, "Ro_in": 3.461, "beta_in": 0.581, "Lu_ft": 58.8},
    "600S300-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.531, "weight_lbft": 5.21, "Ix_in4": 8.785, "Sx_in3": 2.928, "Rx_in": 2.395, "Iy_in4": 1.704, "Ry_in": 1.055, "Ixe_in4": 8.785, "Sxe_in3": 2.84, "Mal_inkip": 64.29, "Mad_inkip": 2.0, "Vag_lb": 66.28, "Vnet_lb": 8267.0, "Jx1000_in4": 2391.0, "Cw_in6": 7.872, "Xo_in": 12.683, "m_in": -2.212, "Ro_in": 1.328, "beta_in": 3.427, "Lu_ft": 0.583},
    "600S300-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.531, "weight_lbft": 5.21, "Ix_in4": 8.785, "Sx_in3": 2.928, "Rx_in": 2.395, "Iy_in4": 1.704, "Ry_in": 1.055, "Ixe_in4": 8.713, "Sxe_in3": 2.797, "Mal_inkip": 94.24, "Mad_inkip": 2.0, "Vag_lb": 90.37, "Vnet_lb": 12526.0, "Jx1000_in4": 3622.0, "Cw_in6": 7.872, "Xo_in": 12.683, "m_in": -2.212, "Ro_in": 1.328, "beta_in": 3.427, "Lu_ft": 0.583},
    "600S350-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.825, "weight_lbft": 2.81, "Ix_in4": 5.022, "Sx_in3": 1.674, "Rx_in": 2.467, "Iy_in4": 1.491, "Ry_in": 1.344, "Ixe_in4": 4.911, "Sxe_in3": 1.452, "Mal_inkip": 28.7, "Mad_inkip": 27.98, "Vag_lb": 2739.0, "Vnet_lb": 1890.0, "Jx1000_in4": 0.881, "Cw_in6": 12.942, "Xo_in": -3.037, "m_in": 1.787, "Ro_in": 4.137, "beta_in": 0.461, "Lu_ft": 91.8},
    "600S350-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.825, "weight_lbft": 2.81, "Ix_in4": 5.022, "Sx_in3": 1.674, "Rx_in": 2.467, "Iy_in4": 1.491, "Ry_in": 1.344, "Ixe_in4": 4.721, "Sxe_in3": 1.335, "Mal_inkip": 39.97, "Mad_inkip": 36.56, "Vag_lb": 2823.0, "Vnet_lb": 1947.0, "Jx1000_in4": 0.881, "Cw_in6": 12.942, "Xo_in": -3.037, "m_in": 1.787, "Ro_in": 4.137, "beta_in": 0.461, "Lu_ft": 74.4},
    "600S350-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.032, "weight_lbft": 3.51, "Ix_in4": 6.237, "Sx_in3": 2.079, "Rx_in": 2.459, "Iy_in4": 1.841, "Ry_in": 1.336, "Ixe_in4": 6.237, "Sxe_in3": 1.949, "Mal_inkip": 38.5, "Mad_inkip": 37.63, "Vag_lb": 4347.0, "Vnet_lb": 2339.0, "Jx1000_in4": 1.748, "Cw_in6": 15.968, "Xo_in": -3.018, "m_in": 1.777, "Ro_in": 4.115, "beta_in": 0.462, "Lu_ft": 91.8},
    "600S350-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.032, "weight_lbft": 3.51, "Ix_in4": 6.237, "Sx_in3": 2.079, "Rx_in": 2.459, "Iy_in4": 1.841, "Ry_in": 1.336, "Ixe_in4": 6.166, "Sxe_in3": 1.771, "Mal_inkip": 53.01, "Mad_inkip": 49.69, "Vag_lb": 5350.0, "Vnet_lb": 2879.0, "Jx1000_in4": 1.748, "Cw_in6": 15.968, "Xo_in": -3.018, "m_in": 1.777, "Ro_in": 4.115, "beta_in": 0.462, "Lu_ft": 74.4},
    "600S350-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.449, "weight_lbft": 4.93, "Ix_in4": 8.631, "Sx_in3": 2.877, "Rx_in": 2.441, "Iy_in4": 2.518, "Ry_in": 1.318, "Ixe_in4": 8.631, "Sxe_in3": 2.822, "Mal_inkip": 61.55, "Mad_inkip": 2.0, "Vag_lb": 62.49, "Vnet_lb": 6911.0, "Jx1000_in4": 2512.0, "Cw_in6": 4.994, "Xo_in": 21.811, "m_in": -2.979, "Ro_in": 1.757, "beta_in": 4.071, "Lu_ft": 0.464},
    "600S350-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.449, "weight_lbft": 4.93, "Ix_in4": 8.631, "Sx_in3": 2.877, "Rx_in": 2.441, "Iy_in4": 2.518, "Ry_in": 1.318, "Ixe_in4": 8.631, "Sxe_in3": 2.593, "Mal_inkip": 77.64, "Mad_inkip": 78.36, "Vag_lb": 10472.0, "Vnet_lb": 3805.0, "Jx1000_in4": 4.994, "Cw_in6": 21.811, "Xo_in": -2.979, "m_in": 1.757, "Ro_in": 4.071, "beta_in": 0.464, "Lu_ft": 74.4},
    "600S350-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.748, "weight_lbft": 5.95, "Ix_in4": 10.304, "Sx_in3": 3.435, "Rx_in": 2.428, "Iy_in4": 2.978, "Ry_in": 1.305, "Ixe_in4": 10.304, "Sxe_in3": 3.435, "Mal_inkip": 76.39, "Mad_inkip": 2.0, "Vag_lb": 76.4, "Vnet_lb": 8267.0, "Jx1000_in4": 2391.0, "Cw_in6": 8.99, "Xo_in": 25.791, "m_in": -2.951, "Ro_in": 1.742, "beta_in": 4.038, "Lu_ft": 0.466},
    "600S350-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.748, "weight_lbft": 5.95, "Ix_in4": 10.304, "Sx_in3": 3.435, "Rx_in": 2.428, "Iy_in4": 2.978, "Ry_in": 1.305, "Ixe_in4": 10.304, "Sxe_in3": 3.268, "Mal_inkip": 108.43, "Mad_inkip": 2.0, "Vag_lb": 107.66, "Vnet_lb": 12526.0, "Jx1000_in4": 3622.0, "Cw_in6": 8.99, "Xo_in": 25.791, "m_in": -2.951, "Ro_in": 1.742, "beta_in": 4.038, "Lu_ft": 0.466},
    "800S125-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.366, "weight_lbft": 1.25, "Ix_in4": 2.881, "Sx_in3": 0.72, "Rx_in": 2.806, "Iy_in4": 0.044, "Ry_in": 0.347, "Ixe_in4": 2.656, "Sxe_in3": 0.507, "Mal_inkip": 10.02, "Mad_inkip": 8.22, "Vag_lb": 474.0, "Vnet_lb": 474.0, "Jx1000_in4": 0.146, "Cw_in6": 0.582, "Xo_in": -0.519, "m_in": 0.349, "Ro_in": 2.875, "beta_in": 0.967, "Lu_ft": 26.6},
    "800S125-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.475, "weight_lbft": 1.62, "Ix_in4": 3.721, "Sx_in3": 0.93, "Rx_in": 2.799, "Iy_in4": 0.056, "Ry_in": 0.342, "Ixe_in4": 3.581, "Sxe_in3": 0.773, "Mal_inkip": 15.27, "Mad_inkip": 12.56, "Vag_lb": 1051.0, "Vnet_lb": 1051.0, "Jx1000_in4": 0.322, "Cw_in6": 0.735, "Xo_in": -0.51, "m_in": 0.344, "Ro_in": 2.865, "beta_in": 0.968, "Lu_ft": 26.3},
    "800S125-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.592, "weight_lbft": 2.01, "Ix_in4": 4.593, "Sx_in3": 1.148, "Rx_in": 2.786, "Iy_in4": 0.066, "Ry_in": 0.335, "Ixe_in4": 4.566, "Sxe_in3": 1.035, "Mal_inkip": 20.46, "Mad_inkip": 17.87, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.632, "Cw_in6": 0.889, "Xo_in": -0.499, "m_in": 0.338, "Ro_in": 2.85, "beta_in": 0.969, "Lu_ft": 26.0},
    "800S125-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.592, "weight_lbft": 2.01, "Ix_in4": 4.593, "Sx_in3": 1.148, "Rx_in": 2.786, "Iy_in4": 0.066, "Ry_in": 0.335, "Ixe_in4": 4.431, "Sxe_in3": 0.942, "Mal_inkip": 28.21, "Mad_inkip": 23.18, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.632, "Cw_in6": 0.889, "Xo_in": -0.499, "m_in": 0.338, "Ro_in": 2.85, "beta_in": 0.969, "Lu_ft": 21.1},
    "800S125-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.738, "weight_lbft": 2.51, "Ix_in4": 5.653, "Sx_in3": 1.413, "Rx_in": 2.768, "Iy_in4": 0.078, "Ry_in": 0.324, "Ixe_in4": 5.644, "Sxe_in3": 1.375, "Mal_inkip": 27.18, "Mad_inkip": 25.21, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.25, "Cw_in6": 1.068, "Xo_in": -0.485, "m_in": 0.33, "Ro_in": 2.829, "beta_in": 0.971, "Lu_ft": 25.6},
    "800S125-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.738, "weight_lbft": 2.51, "Ix_in4": 5.653, "Sx_in3": 1.413, "Rx_in": 2.768, "Iy_in4": 0.078, "Ry_in": 0.324, "Ixe_in4": 5.632, "Sxe_in3": 1.287, "Mal_inkip": 38.54, "Mad_inkip": 33.22, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.25, "Cw_in6": 1.068, "Xo_in": -0.485, "m_in": 0.33, "Ro_in": 2.829, "beta_in": 0.971, "Lu_ft": 20.8},
    "800S137-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.388, "weight_lbft": 1.32, "Ix_in4": 3.198, "Sx_in3": 0.799, "Rx_in": 2.873, "Iy_in4": 0.073, "Ry_in": 0.435, "Ixe_in4": 2.998, "Sxe_in3": 0.622, "Mal_inkip": 12.3, "Mad_inkip": 10.71, "Vag_lb": 474.0, "Vnet_lb": 474.0, "Jx1000_in4": 0.155, "Cw_in6": 0.957, "Xo_in": -0.696, "m_in": 0.46, "Ro_in": 2.987, "beta_in": 0.946, "Lu_ft": 32.5},
    "800S137-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.503, "weight_lbft": 1.71, "Ix_in4": 4.134, "Sx_in3": 1.033, "Rx_in": 2.866, "Iy_in4": 0.093, "Ry_in": 0.43, "Ixe_in4": 4.001, "Sxe_in3": 0.896, "Mal_inkip": 17.7, "Mad_inkip": 15.78, "Vag_lb": 1051.0, "Vnet_lb": 1051.0, "Jx1000_in4": 0.341, "Cw_in6": 1.214, "Xo_in": -0.687, "m_in": 0.454, "Ro_in": 2.978, "beta_in": 0.947, "Lu_ft": 32.2},
    "800S137-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.627, "weight_lbft": 2.13, "Ix_in4": 5.11, "Sx_in3": 1.277, "Rx_in": 2.855, "Iy_in4": 0.112, "Ry_in": 0.423, "Ixe_in4": 5.077, "Sxe_in3": 1.179, "Mal_inkip": 23.29, "Mad_inkip": 21.74, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.67, "Cw_in6": 1.478, "Xo_in": -0.676, "m_in": 0.448, "Ro_in": 2.964, "beta_in": 0.948, "Lu_ft": 32.0},
    "800S137-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.627, "weight_lbft": 2.13, "Ix_in4": 5.11, "Sx_in3": 1.277, "Rx_in": 2.855, "Iy_in4": 0.112, "Ry_in": 0.423, "Ixe_in4": 4.974, "Sxe_in3": 1.083, "Mal_inkip": 32.42, "Mad_inkip": 28.47, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.67, "Cw_in6": 1.478, "Xo_in": -0.676, "m_in": 0.448, "Ro_in": 2.964, "beta_in": 0.948, "Lu_ft": 25.9},
    "800S137-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.782, "weight_lbft": 2.66, "Ix_in4": 6.303, "Sx_in3": 1.576, "Rx_in": 2.839, "Iy_in4": 0.134, "Ry_in": 0.414, "Ixe_in4": 6.303, "Sxe_in3": 1.541, "Mal_inkip": 30.45, "Mad_inkip": 29.75, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.325, "Cw_in6": 1.789, "Xo_in": -0.661, "m_in": 0.44, "Ro_in": 2.944, "beta_in": 0.95, "Lu_ft": 31.6},
    "800S137-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.782, "weight_lbft": 2.66, "Ix_in4": 6.303, "Sx_in3": 1.576, "Rx_in": 2.839, "Iy_in4": 0.134, "Ry_in": 0.414, "Ixe_in4": 6.285, "Sxe_in3": 1.468, "Mal_inkip": 43.96, "Mad_inkip": 39.57, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.325, "Cw_in6": 1.789, "Xo_in": -0.661, "m_in": 0.44, "Ro_in": 2.944, "beta_in": 0.95, "Lu_ft": 25.6},
    "800S137-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.093, "weight_lbft": 3.72, "Ix_in4": 8.597, "Sx_in3": 2.149, "Rx_in": 2.805, "Iy_in4": 0.169, "Ry_in": 0.394, "Ixe_in4": 8.597, "Sxe_in3": 2.149, "Mal_inkip": 53.09, "Mad_inkip": 2.0, "Vag_lb": 53.09, "Vnet_lb": 8843.0, "Jx1000_in4": 4824.0, "Cw_in6": 3.767, "Xo_in": 2.349, "m_in": -0.63, "Ro_in": 0.423, "beta_in": 2.902, "Lu_ft": 0.953},
    "800S137-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.093, "weight_lbft": 3.72, "Ix_in4": 8.597, "Sx_in3": 2.149, "Rx_in": 2.805, "Iy_in4": 0.169, "Ry_in": 0.394, "Ixe_in4": 8.597, "Sxe_in3": 2.149, "Mal_inkip": 64.35, "Mad_inkip": 63.91, "Vag_lb": 10885.0, "Vnet_lb": 5938.0, "Jx1000_in4": 3.767, "Cw_in6": 2.349, "Xo_in": -0.63, "m_in": 0.423, "Ro_in": 2.902, "beta_in": 0.953, "Lu_ft": 25.0},
    "800S137-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.314, "weight_lbft": 4.47, "Ix_in4": 10.147, "Sx_in3": 2.537, "Rx_in": 2.779, "Iy_in4": 0.188, "Ry_in": 0.378, "Ixe_in4": 10.147, "Sxe_in3": 2.537, "Mal_inkip": 65.14, "Mad_inkip": 65.14, "Vag_lb": 11341.0, "Vnet_lb": 4971.0, "Jx1000_in4": 6.755, "Cw_in6": 2.694, "Xo_in": -0.608, "m_in": 0.411, "Ro_in": 2.87, "beta_in": 0.955, "Lu_ft": 26.6},
    "800S137-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.314, "weight_lbft": 4.47, "Ix_in4": 10.147, "Sx_in3": 2.537, "Rx_in": 2.779, "Iy_in4": 0.188, "Ry_in": 0.378, "Ixe_in4": 10.147, "Sxe_in3": 2.537, "Mal_inkip": 95.56, "Mad_inkip": 95.56, "Vag_lb": 16235.0, "Vnet_lb": 7115.0, "Jx1000_in4": 6.755, "Cw_in6": 2.694, "Xo_in": -0.608, "m_in": 0.411, "Ro_in": 2.87, "beta_in": 0.955, "Lu_ft": 21.9},
    "800S162-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.413, "weight_lbft": 1.41, "Ix_in4": 3.582, "Sx_in3": 0.896, "Rx_in": 2.943, "Iy_in4": 0.125, "Ry_in": 0.55, "Ixe_in4": 3.384, "Sxe_in3": 0.71, "Mal_inkip": 14.03, "Mad_inkip": 12.61, "Vag_lb": 474.0, "Vnet_lb": 474.0, "Jx1000_in4": 0.165, "Cw_in6": 1.63, "Xo_in": -0.936, "m_in": 0.607, "Ro_in": 3.137, "beta_in": 0.911, "Lu_ft": 40.1},
    "800S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.537, "weight_lbft": 1.83, "Ix_in4": 4.633, "Sx_in3": 1.158, "Rx_in": 2.937, "Iy_in4": 0.16, "Ry_in": 0.546, "Ixe_in4": 4.5, "Sxe_in3": 1.019, "Mal_inkip": 20.14, "Mad_inkip": 18.33, "Vag_lb": 1051.0, "Vnet_lb": 1051.0, "Jx1000_in4": 0.364, "Cw_in6": 2.076, "Xo_in": -0.926, "m_in": 0.601, "Ro_in": 3.128, "beta_in": 0.912, "Lu_ft": 39.8},
    "800S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.67, "weight_lbft": 2.28, "Ix_in4": 5.736, "Sx_in3": 1.434, "Rx_in": 2.927, "Iy_in4": 0.194, "Ry_in": 0.539, "Ixe_in4": 5.702, "Sxe_in3": 1.334, "Mal_inkip": 26.36, "Mad_inkip": 24.98, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.715, "Cw_in6": 2.539, "Xo_in": -0.914, "m_in": 0.594, "Ro_in": 3.113, "beta_in": 0.914, "Lu_ft": 39.6},
    "800S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.67, "weight_lbft": 2.28, "Ix_in4": 5.736, "Sx_in3": 1.434, "Rx_in": 2.927, "Iy_in4": 0.194, "Ry_in": 0.539, "Ixe_in4": 5.6, "Sxe_in3": 1.229, "Mal_inkip": 36.79, "Mad_inkip": 32.81, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.715, "Cw_in6": 2.539, "Xo_in": -0.914, "m_in": 0.594, "Ro_in": 3.113, "beta_in": 0.914, "Lu_ft": 32.1},
    "800S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.836, "weight_lbft": 2.84, "Ix_in4": 7.089, "Sx_in3": 1.772, "Rx_in": 2.913, "Iy_in4": 0.235, "Ry_in": 0.53, "Ixe_in4": 7.089, "Sxe_in3": 1.737, "Mal_inkip": 34.32, "Mad_inkip": 33.84, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.416, "Cw_in6": 3.093, "Xo_in": -0.899, "m_in": 0.586, "Ro_in": 3.094, "beta_in": 0.916, "Lu_ft": 39.3},
    "800S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.836, "weight_lbft": 2.84, "Ix_in4": 7.089, "Sx_in3": 1.772, "Rx_in": 2.913, "Iy_in4": 0.235, "Ry_in": 0.53, "Ixe_in4": 7.07, "Sxe_in3": 1.663, "Mal_inkip": 49.8, "Mad_inkip": 45.11, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.416, "Cw_in6": 3.093, "Xo_in": -0.899, "m_in": 0.586, "Ro_in": 3.094, "beta_in": 0.916, "Lu_ft": 31.9},
    "800S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.169, "weight_lbft": 3.98, "Ix_in4": 9.713, "Sx_in3": 2.428, "Rx_in": 2.883, "Iy_in4": 0.305, "Ry_in": 0.51, "Ixe_in4": 9.713, "Sxe_in3": 2.428, "Mal_inkip": 58.27, "Mad_inkip": 2.0, "Vag_lb": 58.27, "Vnet_lb": 8843.0, "Jx1000_in4": 4824.0, "Cw_in6": 4.03, "Xo_in": 4.114, "m_in": -0.866, "Ro_in": 0.568, "beta_in": 3.053, "Lu_ft": 0.919},
    "800S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.169, "weight_lbft": 3.98, "Ix_in4": 9.713, "Sx_in3": 2.428, "Rx_in": 2.883, "Iy_in4": 0.305, "Ry_in": 0.51, "Ixe_in4": 9.713, "Sxe_in3": 2.428, "Mal_inkip": 72.7, "Mad_inkip": 71.93, "Vag_lb": 10885.0, "Vnet_lb": 5938.0, "Jx1000_in4": 4.03, "Cw_in6": 4.114, "Xo_in": -0.866, "m_in": 0.568, "Ro_in": 3.053, "beta_in": 0.919, "Lu_ft": 31.4},
    "800S162-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.407, "weight_lbft": 4.79, "Ix_in4": 11.504, "Sx_in3": 2.876, "Rx_in": 2.86, "Iy_in4": 0.345, "Ry_in": 0.496, "Ixe_in4": 11.504, "Sxe_in3": 2.876, "Mal_inkip": 71.47, "Mad_inkip": 2.0, "Vag_lb": 71.47, "Vnet_lb": 11341.0, "Jx1000_in4": 4971.0, "Cw_in6": 7.234, "Xo_in": 4.766, "m_in": -0.842, "Ro_in": 0.556, "beta_in": 3.022, "Lu_ft": 0.922},
    "800S162-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.407, "weight_lbft": 4.79, "Ix_in4": 11.504, "Sx_in3": 2.876, "Rx_in": 2.86, "Iy_in4": 0.345, "Ry_in": 0.496, "Ixe_in4": 11.504, "Sxe_in3": 2.876, "Mal_inkip": 105.23, "Mad_inkip": 2.0, "Vag_lb": 105.23, "Vnet_lb": 16235.0, "Jx1000_in4": 7115.0, "Cw_in6": 7.234, "Xo_in": 4.766, "m_in": -0.842, "Ro_in": 0.556, "beta_in": 3.022, "Lu_ft": 0.922},
    "800S200-33_33ksi": {"thickness_in": 0.0346, "Fy_ksi": 33.0, "area_in2": 0.448, "weight_lbft": 1.52, "Ix_in4": 4.096, "Sx_in3": 1.024, "Rx_in": 3.023, "Iy_in4": 0.227, "Ry_in": 0.712, "Ixe_in4": 4.096, "Sxe_in3": 0.816, "Mal_inkip": 16.12, "Mad_inkip": 14.52, "Vag_lb": 474.0, "Vnet_lb": 474.0, "Jx1000_in4": 0.179, "Cw_in6": 2.971, "Xo_in": -1.288, "m_in": 0.817, "Ro_in": 3.363, "beta_in": 0.853, "Lu_ft": 50.6},
    "800S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.582, "weight_lbft": 1.98, "Ix_in4": 5.302, "Sx_in3": 1.325, "Rx_in": 3.018, "Iy_in4": 0.292, "Ry_in": 0.708, "Ixe_in4": 5.302, "Sxe_in3": 1.293, "Mal_inkip": 25.54, "Mad_inkip": 20.99, "Vag_lb": 1051.0, "Vnet_lb": 1051.0, "Jx1000_in4": 0.395, "Cw_in6": 3.797, "Xo_in": -1.277, "m_in": 0.811, "Ro_in": 3.353, "beta_in": 0.855, "Lu_ft": 50.3},
    "800S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.726, "weight_lbft": 2.47, "Ix_in4": 6.573, "Sx_in3": 1.643, "Rx_in": 3.009, "Iy_in4": 0.357, "Ry_in": 0.701, "Ixe_in4": 6.573, "Sxe_in3": 1.643, "Mal_inkip": 35.75, "Mad_inkip": 2.0, "Vag_lb": 30.37, "Vnet_lb": 2091.0, "Jx1000_in4": 2091.0, "Cw_in6": 0.775, "Xo_in": 4.663, "m_in": -1.265, "Ro_in": 0.804, "beta_in": 3.338, "Lu_ft": 0.856},
    "800S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.726, "weight_lbft": 2.47, "Ix_in4": 6.573, "Sx_in3": 1.643, "Rx_in": 3.009, "Iy_in4": 0.357, "Ry_in": 0.701, "Ixe_in4": 6.573, "Sxe_in3": 1.499, "Mal_inkip": 44.87, "Mad_inkip": 37.37, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.775, "Cw_in6": 4.663, "Xo_in": -1.265, "m_in": 0.804, "Ro_in": 3.338, "beta_in": 0.856, "Lu_ft": 40.7},
    "800S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.907, "weight_lbft": 3.09, "Ix_in4": 8.14, "Sx_in3": 2.035, "Rx_in": 2.996, "Iy_in4": 0.435, "Ry_in": 0.692, "Ixe_in4": 8.14, "Sxe_in3": 2.035, "Mal_inkip": 45.29, "Mad_inkip": 2.0, "Vag_lb": 41.79, "Vnet_lb": 4221.0, "Jx1000_in4": 3367.0, "Cw_in6": 1.537, "Xo_in": 5.712, "m_in": -1.248, "Ro_in": 0.796, "beta_in": 3.319, "Lu_ft": 0.859},
    "800S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.907, "weight_lbft": 3.09, "Ix_in4": 8.14, "Sx_in3": 2.035, "Rx_in": 2.996, "Iy_in4": 0.435, "Ry_in": 0.692, "Ixe_in4": 8.14, "Sxe_in3": 1.964, "Mal_inkip": 65.21, "Mad_inkip": 2.0, "Vag_lb": 54.7, "Vnet_lb": 4221.0, "Jx1000_in4": 3367.0, "Cw_in6": 1.537, "Xo_in": 5.712, "m_in": -1.248, "Ro_in": 0.796, "beta_in": 3.319, "Lu_ft": 0.859},
    "800S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.271, "weight_lbft": 4.32, "Ix_in4": 11.203, "Sx_in3": 2.801, "Rx_in": 2.969, "Iy_in4": 0.576, "Ry_in": 0.673, "Ixe_in4": 11.203, "Sxe_in3": 2.801, "Mal_inkip": 65.12, "Mad_inkip": 2.0, "Vag_lb": 65.12, "Vnet_lb": 8843.0, "Jx1000_in4": 4824.0, "Cw_in6": 4.381, "Xo_in": 7.684, "m_in": -1.214, "Ro_in": 0.777, "beta_in": 3.278, "Lu_ft": 0.863},
    "800S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.271, "weight_lbft": 4.32, "Ix_in4": 11.203, "Sx_in3": 2.801, "Rx_in": 2.969, "Iy_in4": 0.576, "Ry_in": 0.673, "Ixe_in4": 11.203, "Sxe_in3": 2.801, "Mal_inkip": 96.63, "Mad_inkip": 2.0, "Vag_lb": 89.76, "Vnet_lb": 10885.0, "Jx1000_in4": 5938.0, "Cw_in6": 4.381, "Xo_in": 7.684, "m_in": -1.214, "Ro_in": 0.777, "beta_in": 3.278, "Lu_ft": 0.863},
    "800S200-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.531, "weight_lbft": 5.21, "Ix_in4": 13.316, "Sx_in3": 3.329, "Rx_in": 2.949, "Iy_in4": 0.665, "Ry_in": 0.659, "Ixe_in4": 13.316, "Sxe_in3": 3.329, "Mal_inkip": 79.78, "Mad_inkip": 2.0, "Vag_lb": 79.78, "Vnet_lb": 11341.0, "Jx1000_in4": 4971.0, "Cw_in6": 7.872, "Xo_in": 8.981, "m_in": -1.188, "Ro_in": 0.764, "beta_in": 3.247, "Lu_ft": 0.866},
    "800S200-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.531, "weight_lbft": 5.21, "Ix_in4": 13.316, "Sx_in3": 3.329, "Rx_in": 2.949, "Iy_in4": 0.665, "Ry_in": 0.659, "Ixe_in4": 13.316, "Sxe_in3": 3.329, "Mal_inkip": 117.95, "Mad_inkip": 2.0, "Vag_lb": 117.55, "Vnet_lb": 16235.0, "Jx1000_in4": 7115.0, "Cw_in6": 7.872, "Xo_in": 8.981, "m_in": -1.188, "Ro_in": 0.764, "beta_in": 3.247, "Lu_ft": 0.866},
    "800S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.627, "weight_lbft": 2.13, "Ix_in4": 6.015, "Sx_in3": 1.504, "Rx_in": 3.097, "Iy_in4": 0.5, "Ry_in": 0.893, "Ixe_in4": 6.015, "Sxe_in3": 1.313, "Mal_inkip": 25.95, "Mad_inkip": 22.06, "Vag_lb": 1051.0, "Vnet_lb": 1051.0, "Jx1000_in4": 0.425, "Cw_in6": 6.374, "Xo_in": -1.675, "m_in": 1.043, "Ro_in": 3.632, "beta_in": 0.787, "Lu_ft": 61.5},
    "800S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.783, "weight_lbft": 2.66, "Ix_in4": 7.465, "Sx_in3": 1.866, "Rx_in": 3.088, "Iy_in4": 0.614, "Ry_in": 0.886, "Ixe_in4": 7.465, "Sxe_in3": 1.712, "Mal_inkip": 33.82, "Mad_inkip": 30.07, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.836, "Cw_in6": 7.85, "Xo_in": -1.661, "m_in": 1.036, "Ro_in": 3.617, "beta_in": 0.789, "Lu_ft": 61.4},
    "800S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.783, "weight_lbft": 2.66, "Ix_in4": 7.465, "Sx_in3": 1.866, "Rx_in": 3.088, "Iy_in4": 0.614, "Ry_in": 0.886, "Ixe_in4": 7.378, "Sxe_in3": 1.525, "Mal_inkip": 45.66, "Mad_inkip": 39.13, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.836, "Cw_in6": 7.85, "Xo_in": -1.661, "m_in": 1.036, "Ro_in": 3.617, "beta_in": 0.789, "Lu_ft": 49.8},
    "800S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.978, "weight_lbft": 3.33, "Ix_in4": 9.261, "Sx_in3": 2.315, "Rx_in": 3.077, "Iy_in4": 0.752, "Ry_in": 0.877, "Ixe_in4": 9.261, "Sxe_in3": 2.22, "Mal_inkip": 48.332, "Mad_inkip": 43.63, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.658, "Cw_in6": 9.652, "Xo_in": -1.644, "m_in": 1.027, "Ro_in": 3.597, "beta_in": 0.791, "Lu_ft": 58.2},
    "800S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.978, "weight_lbft": 3.33, "Ix_in4": 9.261, "Sx_in3": 2.315, "Rx_in": 3.077, "Iy_in4": 0.752, "Ry_in": 0.877, "Ixe_in4": 9.24, "Sxe_in3": 2.059, "Mal_inkip": 61.65, "Mad_inkip": 53.75, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.658, "Cw_in6": 9.652, "Xo_in": -1.644, "m_in": 1.027, "Ro_in": 3.597, "beta_in": 0.791, "Lu_ft": 49.6},
    "800S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.372, "weight_lbft": 4.67, "Ix_in4": 12.789, "Sx_in3": 3.197, "Rx_in": 3.053, "Iy_in4": 1.009, "Ry_in": 0.857, "Ixe_in4": 12.789, "Sxe_in3": 3.191, "Mal_inkip": 72.072, "Mad_inkip": 70.72, "Vag_lb": 8843.0, "Vnet_lb": 4824.0, "Jx1000_in4": 4.731, "Cw_in6": 13.091, "Xo_in": -1.607, "m_in": 1.008, "Ro_in": 3.555, "beta_in": 0.796, "Lu_ft": 56.8},
    "800S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.372, "weight_lbft": 4.67, "Ix_in4": 12.789, "Sx_in3": 3.197, "Rx_in": 3.053, "Iy_in4": 1.009, "Ry_in": 0.857, "Ixe_in4": 12.789, "Sxe_in3": 3.054, "Mal_inkip": 102.702, "Mad_inkip": 93.42, "Vag_lb": 10885.0, "Vnet_lb": 5938.0, "Jx1000_in4": 4.731, "Cw_in6": 13.091, "Xo_in": -1.607, "m_in": 1.008, "Ro_in": 3.555, "beta_in": 0.796, "Lu_ft": 46.4},
    "800S250-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.655, "weight_lbft": 5.63, "Ix_in4": 15.242, "Sx_in3": 3.81, "Rx_in": 3.035, "Iy_in4": 1.175, "Ry_in": 0.843, "Ixe_in4": 15.242, "Sxe_in3": 3.81, "Mal_inkip": 88.312, "Mad_inkip": 88.31, "Vag_lb": 11341.0, "Vnet_lb": 4971.0, "Jx1000_in4": 8.511, "Cw_in6": 15.395, "Xo_in": -1.58, "m_in": 0.994, "Ro_in": 3.524, "beta_in": 0.799, "Lu_ft": 55.9},
    "800S250-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.655, "weight_lbft": 5.63, "Ix_in4": 15.242, "Sx_in3": 3.81, "Rx_in": 3.035, "Iy_in4": 1.175, "Ry_in": 0.843, "Ixe_in4": 15.242, "Sxe_in3": 3.707, "Mal_inkip": 127.512, "Mad_inkip": 122.92, "Vag_lb": 16235.0, "Vnet_lb": 7115.0, "Jx1000_in4": 8.511, "Cw_in6": 15.395, "Xo_in": -1.58, "m_in": 0.994, "Ro_in": 3.524, "beta_in": 0.799, "Lu_ft": 45.6},
    "800S300-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.839, "weight_lbft": 2.86, "Ix_in4": 8.358, "Sx_in3": 2.09, "Rx_in": 3.156, "Iy_in4": 0.96, "Ry_in": 1.069, "Ixe_in4": 8.249, "Sxe_in3": 1.785, "Mal_inkip": 35.28, "Mad_inkip": 31.13, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.896, "Cw_in6": 12.076, "Xo_in": -2.073, "m_in": 1.271, "Ro_in": 3.924, "beta_in": 0.721, "Lu_ft": 72.2},
    "800S300-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.839, "weight_lbft": 2.86, "Ix_in4": 8.358, "Sx_in3": 2.09, "Rx_in": 3.156, "Iy_in4": 0.96, "Ry_in": 1.069, "Ixe_in4": 7.862, "Sxe_in3": 1.535, "Mal_inkip": 45.96, "Mad_inkip": 40.22, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 0.896, "Cw_in6": 12.076, "Xo_in": -2.073, "m_in": 1.271, "Ro_in": 3.924, "beta_in": 0.721, "Lu_ft": 58.6},
    "800S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.05, "weight_lbft": 3.57, "Ix_in4": 10.382, "Sx_in3": 2.595, "Rx_in": 3.145, "Iy_in4": 1.179, "Ry_in": 1.06, "Ixe_in4": 10.351, "Sxe_in3": 2.321, "Mal_inkip": 45.86, "Mad_inkip": 42.54, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.779, "Cw_in6": 14.888, "Xo_in": -2.055, "m_in": 1.262, "Ro_in": 3.903, "beta_in": 0.723, "Lu_ft": 72.0},
    "800S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.05, "weight_lbft": 3.57, "Ix_in4": 10.382, "Sx_in3": 2.595, "Rx_in": 3.145, "Iy_in4": 1.179, "Ry_in": 1.06, "Ixe_in4": 10.082, "Sxe_in3": 2.145, "Mal_inkip": 64.21, "Mad_inkip": 55.47, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.779, "Cw_in6": 14.888, "Xo_in": -2.055, "m_in": 1.262, "Ro_in": 3.903, "beta_in": 0.723, "Lu_ft": 58.4},
    "800S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.474, "weight_lbft": 5.02, "Ix_in4": 14.375, "Sx_in3": 3.594, "Rx_in": 3.123, "Iy_in4": 1.595, "Ry_in": 1.04, "Ixe_in4": 14.375, "Sxe_in3": 3.443, "Mal_inkip": 76.212, "Mad_inkip": 73.25, "Vag_lb": 8843.0, "Vnet_lb": 4824.0, "Jx1000_in4": 5.082, "Cw_in6": 20.304, "Xo_in": -2.017, "m_in": 1.243, "Ro_in": 3.86, "beta_in": 0.727, "Lu_ft": 67.7},
    "800S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.474, "weight_lbft": 5.02, "Ix_in4": 14.375, "Sx_in3": 3.594, "Rx_in": 3.123, "Iy_in4": 1.595, "Ry_in": 1.04, "Ixe_in4": 14.17, "Sxe_in3": 3.304, "Mal_inkip": 98.92, "Mad_inkip": 89.89, "Vag_lb": 10885.0, "Vnet_lb": 5938.0, "Jx1000_in4": 5.082, "Cw_in6": 20.304, "Xo_in": -2.017, "m_in": 1.243, "Ro_in": 3.86, "beta_in": 0.727, "Lu_ft": 58.1},
    "800S300-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 17.167, "Sx_in3": 4.292, "Rx_in": 3.106, "Iy_in4": 1.871, "Ry_in": 1.025, "Ixe_in4": 17.167, "Sxe_in3": 4.168, "Mal_inkip": 94.332, "Mad_inkip": 95.78, "Vag_lb": 11341.0, "Vnet_lb": 4971.0, "Jx1000_in4": 9.149, "Cw_in6": 23.979, "Xo_in": -1.989, "m_in": 1.229, "Ro_in": 3.828, "beta_in": 0.73, "Lu_ft": 66.8},
    "800S300-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 17.167, "Sx_in3": 4.292, "Rx_in": 3.106, "Iy_in4": 1.871, "Ry_in": 1.025, "Ixe_in4": 17.022, "Sxe_in3": 4.108, "Mal_inkip": 138.412, "Mad_inkip": 126.69, "Vag_lb": 16235.0, "Vnet_lb": 7115.0, "Jx1000_in4": 9.149, "Cw_in6": 23.979, "Xo_in": -1.989, "m_in": 1.229, "Ro_in": 3.828, "beta_in": 0.73, "Lu_ft": 54.5},
    "800S350-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.938, "weight_lbft": 3.19, "Ix_in4": 9.683, "Sx_in3": 2.421, "Rx_in": 3.212, "Iy_in4": 1.646, "Ry_in": 1.325, "Ixe_in4": 9.477, "Sxe_in3": 2.125, "Mal_inkip": 41.98, "Mad_inkip": 38.29, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 1.002, "Cw_in6": 22.897, "Xo_in": -2.766, "m_in": 1.668, "Ro_in": 4.441, "beta_in": 0.612, "Lu_ft": 90.0},
    "800S350-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.938, "weight_lbft": 3.19, "Ix_in4": 9.683, "Sx_in3": 2.421, "Rx_in": 3.212, "Iy_in4": 1.646, "Ry_in": 1.325, "Ixe_in4": 9.191, "Sxe_in3": 1.869, "Mal_inkip": 55.96, "Mad_inkip": 49.74, "Vag_lb": 2091.0, "Vnet_lb": 2091.0, "Jx1000_in4": 1.002, "Cw_in6": 22.897, "Xo_in": -2.766, "m_in": 1.668, "Ro_in": 4.441, "beta_in": 0.612, "Lu_ft": 73.1},
    "800S350-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.174, "weight_lbft": 4.0, "Ix_in4": 12.046, "Sx_in3": 3.012, "Rx_in": 3.203, "Iy_in4": 2.034, "Ry_in": 1.316, "Ixe_in4": 12.046, "Sxe_in3": 2.837, "Mal_inkip": 56.07, "Mad_inkip": 51.89, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.99, "Cw_in6": 28.308, "Xo_in": -2.748, "m_in": 1.658, "Ro_in": 4.421, "beta_in": 0.614, "Lu_ft": 89.9},
    "800S350-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.174, "weight_lbft": 4.0, "Ix_in4": 12.046, "Sx_in3": 3.012, "Rx_in": 3.203, "Iy_in4": 2.034, "Ry_in": 1.316, "Ixe_in4": 11.909, "Sxe_in3": 2.596, "Mal_inkip": 77.73, "Mad_inkip": 68.05, "Vag_lb": 4221.0, "Vnet_lb": 3367.0, "Jx1000_in4": 1.99, "Cw_in6": 28.308, "Xo_in": -2.748, "m_in": 1.658, "Ro_in": 4.421, "beta_in": 0.614, "Lu_ft": 72.9},
    "800S350-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.652, "weight_lbft": 5.62, "Ix_in4": 16.737, "Sx_in3": 4.184, "Rx_in": 3.183, "Iy_in4": 2.784, "Ry_in": 1.298, "Ixe_in4": 16.737, "Sxe_in3": 4.101, "Mal_inkip": 89.432, "Mad_inkip": 87.25, "Vag_lb": 8843.0, "Vnet_lb": 4824.0, "Jx1000_in4": 5.696, "Cw_in6": 38.834, "Xo_in": -2.71, "m_in": 1.639, "Ro_in": 4.377, "beta_in": 0.617, "Lu_ft": 85.4},
    "800S350-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.652, "weight_lbft": 5.62, "Ix_in4": 16.737, "Sx_in3": 4.184, "Rx_in": 3.183, "Iy_in4": 2.784, "Ry_in": 1.298, "Ixe_in4": 16.737, "Sxe_in3": 3.785, "Mal_inkip": 113.34, "Mad_inkip": 108.67, "Vag_lb": 10885.0, "Vnet_lb": 5938.0, "Jx1000_in4": 5.696, "Cw_in6": 38.834, "Xo_in": -2.71, "m_in": 1.639, "Ro_in": 4.377, "beta_in": 0.617, "Lu_ft": 72.7},
    "800S350-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.997, "weight_lbft": 6.79, "Ix_in4": 20.041, "Sx_in3": 5.01, "Rx_in": 3.168, "Iy_in4": 3.295, "Ry_in": 1.285, "Ixe_in4": 20.041, "Sxe_in3": 5.01, "Mal_inkip": 111.442, "Mad_inkip": 111.44, "Vag_lb": 11341.0, "Vnet_lb": 4971.0, "Jx1000_in4": 10.267, "Cw_in6": 46.068, "Xo_in": -2.682, "m_in": 1.624, "Ro_in": 4.345, "beta_in": 0.619, "Lu_ft": 84.6},
    "800S350-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.997, "weight_lbft": 6.79, "Ix_in4": 20.041, "Sx_in3": 5.01, "Rx_in": 3.168, "Iy_in4": 3.295, "Ry_in": 1.285, "Ixe_in4": 20.041, "Sxe_in3": 4.762, "Mal_inkip": 158.022, "Mad_inkip": 150.37, "Vag_lb": 16235.0, "Vnet_lb": 7115.0, "Jx1000_in4": 10.267, "Cw_in6": 46.068, "Xo_in": -2.682, "m_in": 1.624, "Ro_in": 4.345, "beta_in": 0.619, "Lu_ft": 68.9},
    "1000S162-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.627, "weight_lbft": 2.13, "Ix_in4": 8.025, "Sx_in3": 1.605, "Rx_in": 3.577, "Iy_in4": 0.168, "Ry_in": 0.518, "Ixe_in4": 7.523, "Sxe_in3": 1.302, "Mal_inkip": 25.74, "Mad_inkip": 22.49, "Vag_lb": 836.0, "Vnet_lb": 836.0, "Jx1000_in4": 0.425, "Cw_in6": 3.43, "Xo_in": -0.823, "m_in": 0.545, "Ro_in": 3.707, "beta_in": 0.951, "Lu_ft": 38.8},
    "1000S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.783, "weight_lbft": 2.66, "Ix_in4": 9.95, "Sx_in3": 1.99, "Rx_in": 3.565, "Iy_in4": 0.204, "Ry_in": 0.511, "Ixe_in4": 9.627, "Sxe_in3": 1.722, "Mal_inkip": 34.02, "Mad_inkip": 31.11, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 0.836, "Cw_in6": 4.198, "Xo_in": -0.812, "m_in": 0.538, "Ro_in": 3.692, "beta_in": 0.952, "Lu_ft": 38.6},
    "1000S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.783, "weight_lbft": 2.66, "Ix_in4": 9.95, "Sx_in3": 1.99, "Rx_in": 3.565, "Iy_in4": 0.204, "Ry_in": 0.511, "Ixe_in4": 9.391, "Sxe_in3": 1.572, "Mal_inkip": 47.07, "Mad_inkip": 40.37, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 0.836, "Cw_in6": 4.198, "Xo_in": -0.812, "m_in": 0.538, "Ro_in": 3.692, "beta_in": 0.952, "Lu_ft": 31.3},
    "1000S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 0.978, "weight_lbft": 3.33, "Ix_in4": 12.325, "Sx_in3": 2.465, "Rx_in": 3.55, "Iy_in4": 0.246, "Ry_in": 0.502, "Ixe_in4": 12.256, "Sxe_in3": 2.276, "Mal_inkip": 44.98, "Mad_inkip": 42.91, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 1.658, "Cw_in6": 5.121, "Xo_in": -0.798, "m_in": 0.531, "Ro_in": 3.673, "beta_in": 0.953, "Lu_ft": 38.2},
    "1000S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 0.978, "weight_lbft": 3.33, "Ix_in4": 12.325, "Sx_in3": 2.465, "Rx_in": 3.55, "Iy_in4": 0.246, "Ry_in": 0.502, "Ixe_in4": 11.978, "Sxe_in3": 2.154, "Mal_inkip": 64.51, "Mad_inkip": 56.35, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 1.658, "Cw_in6": 5.121, "Xo_in": -0.798, "m_in": 0.531, "Ro_in": 3.673, "beta_in": 0.953, "Lu_ft": 31.0},
    "1000S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.372, "weight_lbft": 4.67, "Ix_in4": 16.967, "Sx_in3": 3.393, "Rx_in": 3.516, "Iy_in4": 0.32, "Ry_in": 0.483, "Ixe_in4": 16.967, "Sxe_in3": 3.393, "Mal_inkip": 67.06, "Mad_inkip": 67.05, "Vag_lb": 8843.0, "Vnet_lb": 6434.0, "Jx1000_in4": 4.731, "Cw_in6": 6.827, "Xo_in": -0.768, "m_in": 0.514, "Ro_in": 3.631, "beta_in": 0.955, "Lu_ft": 37.5},
    "1000S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.372, "weight_lbft": 4.67, "Ix_in4": 16.967, "Sx_in3": 3.393, "Rx_in": 3.516, "Iy_in4": 0.32, "Ry_in": 0.483, "Ixe_in4": 16.967, "Sxe_in3": 3.269, "Mal_inkip": 97.89, "Mad_inkip": 92.56, "Vag_lb": 9864.0, "Vnet_lb": 7177.0, "Jx1000_in4": 4.731, "Cw_in6": 6.827, "Xo_in": -0.768, "m_in": 0.514, "Ro_in": 3.631, "beta_in": 0.955, "Lu_ft": 30.4},
    "1000S162-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.655, "weight_lbft": 5.63, "Ix_in4": 20.169, "Sx_in3": 4.034, "Rx_in": 3.491, "Iy_in4": 0.363, "Ry_in": 0.468, "Ixe_in4": 20.169, "Sxe_in3": 4.034, "Mal_inkip": 100.242, "Mad_inkip": 100.25, "Vag_lb": 13189.0, "Vnet_lb": 7747.0, "Jx1000_in4": 8.511, "Cw_in6": 7.924, "Xo_in": -0.746, "m_in": 0.502, "Ro_in": 3.6, "beta_in": 0.957, "Lu_ft": 32.9},
    "1000S162-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.655, "weight_lbft": 5.63, "Ix_in4": 20.169, "Sx_in3": 4.034, "Rx_in": 3.491, "Iy_in4": 0.363, "Ry_in": 0.468, "Ixe_in4": 20.169, "Sxe_in3": 4.034, "Mal_inkip": 120.77, "Mad_inkip": 120.34, "Vag_lb": 16235.0, "Vnet_lb": 9536.0, "Jx1000_in4": 8.511, "Cw_in6": 7.924, "Xo_in": -0.746, "m_in": 0.502, "Ro_in": 3.6, "beta_in": 0.957, "Lu_ft": 30.0},
    "1000S200-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.672, "weight_lbft": 2.29, "Ix_in4": 9.085, "Sx_in3": 1.817, "Rx_in": 3.676, "Iy_in4": 0.309, "Ry_in": 0.677, "Ixe_in4": 8.602, "Sxe_in3": 1.47, "Mal_inkip": 29.05, "Mad_inkip": 26.14, "Vag_lb": 836.0, "Vnet_lb": 836.0, "Jx1000_in4": 0.456, "Cw_in6": 6.236, "Xo_in": -1.147, "m_in": 0.743, "Ro_in": 3.91, "beta_in": 0.914, "Lu_ft": 49.3},
    "1000S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.839, "weight_lbft": 2.86, "Ix_in4": 11.278, "Sx_in3": 2.256, "Rx_in": 3.666, "Iy_in4": 0.378, "Ry_in": 0.671, "Ixe_in4": 10.953, "Sxe_in3": 1.984, "Mal_inkip": 39.2, "Mad_inkip": 35.86, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 0.896, "Cw_in6": 7.665, "Xo_in": -1.135, "m_in": 0.737, "Ro_in": 3.896, "beta_in": 0.915, "Lu_ft": 49.1},
    "1000S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.839, "weight_lbft": 2.86, "Ix_in4": 11.278, "Sx_in3": 2.256, "Rx_in": 3.666, "Iy_in4": 0.378, "Ry_in": 0.671, "Ixe_in4": 10.769, "Sxe_in3": 1.705, "Mal_inkip": 51.05, "Mad_inkip": 46.62, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 0.896, "Cw_in6": 7.665, "Xo_in": -1.135, "m_in": 0.737, "Ro_in": 3.896, "beta_in": 0.915, "Lu_ft": 39.8},
    "1000S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.05, "weight_lbft": 3.57, "Ix_in4": 13.994, "Sx_in3": 2.799, "Rx_in": 3.652, "Iy_in4": 0.46, "Ry_in": 0.662, "Ixe_in4": 13.92, "Sxe_in3": 2.607, "Mal_inkip": 51.51, "Mad_inkip": 49.07, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 1.779, "Cw_in6": 9.401, "Xo_in": -1.12, "m_in": 0.729, "Ro_in": 3.876, "beta_in": 0.917, "Lu_ft": 48.8},
    "1000S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.05, "weight_lbft": 3.57, "Ix_in4": 13.994, "Sx_in3": 2.799, "Rx_in": 3.652, "Iy_in4": 0.46, "Ry_in": 0.662, "Ixe_in4": 13.665, "Sxe_in3": 2.42, "Mal_inkip": 72.46, "Mad_inkip": 64.5, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 1.779, "Cw_in6": 9.401, "Xo_in": -1.12, "m_in": 0.729, "Ro_in": 3.876, "beta_in": 0.917, "Lu_ft": 39.6},
    "1000S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.474, "weight_lbft": 5.02, "Ix_in4": 19.336, "Sx_in3": 3.867, "Rx_in": 3.622, "Iy_in4": 0.609, "Ry_in": 0.643, "Ixe_in4": 19.336, "Sxe_in3": 3.867, "Mal_inkip": 76.42, "Mad_inkip": 76.42, "Vag_lb": 8843.0, "Vnet_lb": 6434.0, "Jx1000_in4": 5.082, "Cw_in6": 12.679, "Xo_in": -1.088, "m_in": 0.711, "Ro_in": 3.836, "beta_in": 0.92, "Lu_ft": 48.2},
    "1000S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.474, "weight_lbft": 5.02, "Ix_in4": 19.336, "Sx_in3": 3.867, "Rx_in": 3.622, "Iy_in4": 0.609, "Ry_in": 0.643, "Ixe_in4": 19.336, "Sxe_in3": 3.741, "Mal_inkip": 112.0, "Mad_inkip": 104.73, "Vag_lb": 9864.0, "Vnet_lb": 7177.0, "Jx1000_in4": 5.082, "Cw_in6": 12.679, "Xo_in": -1.088, "m_in": 0.711, "Ro_in": 3.836, "beta_in": 0.92, "Lu_ft": 39.0},
    "1000S200-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 23.052, "Sx_in3": 4.61, "Rx_in": 3.599, "Iy_in4": 0.703, "Ry_in": 0.629, "Ixe_in4": 23.052, "Sxe_in3": 4.61, "Mal_inkip": 110.502, "Mad_inkip": 110.5, "Vag_lb": 13189.0, "Vnet_lb": 7747.0, "Jx1000_in4": 9.149, "Cw_in6": 14.848, "Xo_in": -1.064, "m_in": 0.699, "Ro_in": 3.805, "beta_in": 0.922, "Lu_ft": 43.3},
    "1000S200-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 23.052, "Sx_in3": 4.61, "Rx_in": 3.599, "Iy_in4": 0.703, "Ry_in": 0.629, "Ixe_in4": 23.052, "Sxe_in3": 4.61, "Mal_inkip": 138.04, "Mad_inkip": 135.74, "Vag_lb": 16235.0, "Vnet_lb": 9536.0, "Jx1000_in4": 9.149, "Cw_in6": 14.848, "Xo_in": -1.064, "m_in": 0.699, "Ro_in": 3.805, "beta_in": 0.922, "Lu_ft": 38.7},
    "1000S250-43_33ksi": {"thickness_in": 0.0451, "Fy_ksi": 33.0, "area_in2": 0.717, "weight_lbft": 2.44, "Ix_in4": 10.203, "Sx_in3": 2.041, "Rx_in": 3.771, "Iy_in4": 0.531, "Ry_in": 0.86, "Ixe_in4": 10.203, "Sxe_in3": 1.617, "Mal_inkip": 31.95, "Mad_inkip": 27.67, "Vag_lb": 836.0, "Vnet_lb": 836.0, "Jx1000_in4": 0.486, "Cw_in6": 10.481, "Xo_in": -1.518, "m_in": 0.965, "Ro_in": 4.155, "beta_in": 0.867, "Lu_ft": 60.7},
    "1000S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.896, "weight_lbft": 3.05, "Ix_in4": 12.677, "Sx_in3": 2.535, "Rx_in": 3.762, "Iy_in4": 0.653, "Ry_in": 0.854, "Ixe_in4": 12.677, "Sxe_in3": 2.277, "Mal_inkip": 44.99, "Mad_inkip": 38.02, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 0.957, "Cw_in6": 12.922, "Xo_in": -1.505, "m_in": 0.958, "Ro_in": 4.14, "beta_in": 0.868, "Lu_ft": 60.5},
    "1000S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.896, "weight_lbft": 3.05, "Ix_in4": 12.677, "Sx_in3": 2.535, "Rx_in": 3.762, "Iy_in4": 0.653, "Ry_in": 0.854, "Ixe_in4": 12.66, "Sxe_in3": 1.879, "Mal_inkip": 56.26, "Mad_inkip": 49.16, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 0.957, "Cw_in6": 12.922, "Xo_in": -1.505, "m_in": 0.958, "Ro_in": 4.14, "beta_in": 0.868, "Lu_ft": 49.1},
    "1000S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.121, "weight_lbft": 3.81, "Ix_in4": 15.751, "Sx_in3": 3.15, "Rx_in": 3.749, "Iy_in4": 0.799, "Ry_in": 0.844, "Ixe_in4": 15.751, "Sxe_in3": 3.028, "Mal_inkip": 65.932, "Mad_inkip": 55.62, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 1.899, "Cw_in6": 15.909, "Xo_in": -1.488, "m_in": 0.95, "Ro_in": 4.121, "beta_in": 0.87, "Lu_ft": 57.3},
    "1000S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.121, "weight_lbft": 3.81, "Ix_in4": 15.751, "Sx_in3": 3.15, "Rx_in": 3.749, "Iy_in4": 0.799, "Ry_in": 0.844, "Ixe_in4": 15.741, "Sxe_in3": 2.768, "Mal_inkip": 82.89, "Mad_inkip": 68.13, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 1.899, "Cw_in6": 15.909, "Xo_in": -1.488, "m_in": 0.95, "Ro_in": 4.121, "beta_in": 0.87, "Lu_ft": 48.8},
    "1000S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.576, "weight_lbft": 5.36, "Ix_in4": 21.827, "Sx_in3": 4.365, "Rx_in": 3.722, "Iy_in4": 1.072, "Ry_in": 0.825, "Ixe_in4": 21.827, "Sxe_in3": 4.357, "Mal_inkip": 98.412, "Mad_inkip": 91.77, "Vag_lb": 8843.0, "Vnet_lb": 6434.0, "Jx1000_in4": 5.433, "Cw_in6": 21.632, "Xo_in": -1.454, "m_in": 0.932, "Ro_in": 4.08, "beta_in": 0.873, "Lu_ft": 55.8},
    "1000S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.576, "weight_lbft": 5.36, "Ix_in4": 21.827, "Sx_in3": 4.365, "Rx_in": 3.722, "Iy_in4": 1.072, "Ry_in": 0.825, "Ixe_in4": 21.827, "Sxe_in3": 4.181, "Mal_inkip": 140.632, "Mad_inkip": 120.13, "Vag_lb": 9864.0, "Vnet_lb": 7177.0, "Jx1000_in4": 5.433, "Cw_in6": 21.632, "Xo_in": -1.454, "m_in": 0.932, "Ro_in": 4.08, "beta_in": 0.873, "Lu_ft": 45.6},
    "1000S250-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.904, "weight_lbft": 6.48, "Ix_in4": 26.08, "Sx_in3": 5.216, "Rx_in": 3.701, "Iy_in4": 1.249, "Ry_in": 0.81, "Ixe_in4": 26.08, "Sxe_in3": 5.216, "Mal_inkip": 120.892, "Mad_inkip": 120.71, "Vag_lb": 13189.0, "Vnet_lb": 7747.0, "Jx1000_in4": 9.788, "Cw_in6": 25.49, "Xo_in": -1.428, "m_in": 0.918, "Ro_in": 4.049, "beta_in": 0.876, "Lu_ft": 54.7},
    "1000S250-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.904, "weight_lbft": 6.48, "Ix_in4": 26.08, "Sx_in3": 5.216, "Rx_in": 3.701, "Iy_in4": 1.249, "Ry_in": 0.81, "Ixe_in4": 26.08, "Sxe_in3": 5.082, "Mal_inkip": 174.842, "Mad_inkip": 159.8, "Vag_lb": 16235.0, "Vnet_lb": 9536.0, "Jx1000_in4": 9.788, "Cw_in6": 25.49, "Xo_in": -1.428, "m_in": 0.918, "Ro_in": 4.049, "beta_in": 0.876, "Lu_ft": 44.8},
    "1000S300-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.953, "weight_lbft": 3.24, "Ix_in4": 14.076, "Sx_in3": 2.815, "Rx_in": 3.844, "Iy_in4": 1.024, "Ry_in": 1.037, "Ixe_in4": 13.938, "Sxe_in3": 2.312, "Mal_inkip": 45.69, "Mad_inkip": 39.41, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 1.017, "Cw_in6": 19.888, "Xo_in": -1.892, "m_in": 1.185, "Ro_in": 4.408, "beta_in": 0.816, "Lu_ft": 71.5},
    "1000S300-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.953, "weight_lbft": 3.24, "Ix_in4": 14.076, "Sx_in3": 2.815, "Rx_in": 3.844, "Iy_in4": 1.024, "Ry_in": 1.037, "Ixe_in4": 13.44, "Sxe_in3": 1.902, "Mal_inkip": 56.96, "Mad_inkip": 50.69, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 1.017, "Cw_in6": 19.888, "Xo_in": -1.892, "m_in": 1.185, "Ro_in": 4.408, "beta_in": 0.816, "Lu_ft": 58.1},
    "1000S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.192, "weight_lbft": 4.06, "Ix_in4": 17.509, "Sx_in3": 3.502, "Rx_in": 3.832, "Iy_in4": 1.258, "Ry_in": 1.027, "Ixe_in4": 17.441, "Sxe_in3": 3.158, "Mal_inkip": 62.41, "Mad_inkip": 54.29, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 2.02, "Cw_in6": 24.551, "Xo_in": -1.874, "m_in": 1.176, "Ro_in": 4.388, "beta_in": 0.818, "Lu_ft": 71.3},
    "1000S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.192, "weight_lbft": 4.06, "Ix_in4": 17.509, "Sx_in3": 3.502, "Rx_in": 3.832, "Iy_in4": 1.258, "Ry_in": 1.027, "Ixe_in4": 17.099, "Sxe_in3": 2.802, "Mal_inkip": 83.89, "Mad_inkip": 70.4, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 2.02, "Cw_in6": 24.551, "Xo_in": -1.874, "m_in": 1.176, "Ro_in": 4.388, "beta_in": 0.818, "Lu_ft": 57.8},
    "1000S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.677, "weight_lbft": 5.71, "Ix_in4": 24.318, "Sx_in3": 4.864, "Rx_in": 3.808, "Iy_in4": 1.702, "Ry_in": 1.007, "Ixe_in4": 24.318, "Sxe_in3": 4.671, "Mal_inkip": 103.392, "Mad_inkip": 94.7, "Vag_lb": 8843.0, "Vnet_lb": 6434.0, "Jx1000_in4": 5.783, "Cw_in6": 33.57, "Xo_in": -1.838, "m_in": 1.158, "Ro_in": 4.346, "beta_in": 0.821, "Lu_ft": 66.9},
    "1000S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.677, "weight_lbft": 5.71, "Ix_in4": 24.318, "Sx_in3": 4.864, "Rx_in": 3.808, "Iy_in4": 1.702, "Ry_in": 1.007, "Ixe_in4": 23.97, "Sxe_in3": 4.499, "Mal_inkip": 134.69, "Mad_inkip": 115.62, "Vag_lb": 9864.0, "Vnet_lb": 7177.0, "Jx1000_in4": 5.783, "Cw_in6": 33.57, "Xo_in": -1.838, "m_in": 1.158, "Ro_in": 4.346, "beta_in": 0.821, "Lu_ft": 57.4},
    "1000S300-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.028, "weight_lbft": 6.9, "Ix_in4": 29.109, "Sx_in3": 5.822, "Rx_in": 3.789, "Iy_in4": 1.997, "Ry_in": 0.992, "Ixe_in4": 29.109, "Sxe_in3": 5.662, "Mal_inkip": 128.162, "Mad_inkip": 125.04, "Vag_lb": 13189.0, "Vnet_lb": 7747.0, "Jx1000_in4": 10.427, "Cw_in6": 39.725, "Xo_in": -1.811, "m_in": 1.144, "Ro_in": 4.315, "beta_in": 0.824, "Lu_ft": 65.8},
    "1000S300-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.028, "weight_lbft": 6.9, "Ix_in4": 29.109, "Sx_in3": 5.822, "Rx_in": 3.789, "Iy_in4": 1.997, "Ry_in": 0.992, "Ixe_in4": 28.861, "Sxe_in3": 5.586, "Mal_inkip": 188.232, "Mad_inkip": 164.19, "Vag_lb": 16235.0, "Vnet_lb": 9536.0, "Jx1000_in4": 10.427, "Cw_in6": 39.725, "Xo_in": -1.811, "m_in": 1.144, "Ro_in": 4.315, "beta_in": 0.824, "Lu_ft": 53.8},
    "1000S350-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.052, "weight_lbft": 3.58, "Ix_in4": 16.22, "Sx_in3": 3.244, "Rx_in": 3.927, "Iy_in4": 1.768, "Ry_in": 1.297, "Ixe_in4": 15.942, "Sxe_in3": 2.772, "Mal_inkip": 54.77, "Mad_inkip": 48.69, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 1.123, "Cw_in6": 36.575, "Xo_in": -2.546, "m_in": 1.566, "Ro_in": 4.857, "beta_in": 0.725, "Lu_ft": 88.9},
    "1000S350-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.052, "weight_lbft": 3.58, "Ix_in4": 16.22, "Sx_in3": 3.244, "Rx_in": 3.927, "Iy_in4": 1.768, "Ry_in": 1.297, "Ixe_in4": 15.577, "Sxe_in3": 2.328, "Mal_inkip": 69.69, "Mad_inkip": 62.97, "Vag_lb": 1661.0, "Vnet_lb": 1661.0, "Jx1000_in4": 1.123, "Cw_in6": 36.575, "Xo_in": -2.546, "m_in": 1.566, "Ro_in": 4.857, "beta_in": 0.725, "Lu_ft": 72.2},
    "1000S350-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.317, "weight_lbft": 4.48, "Ix_in4": 20.204, "Sx_in3": 4.041, "Rx_in": 3.917, "Iy_in4": 2.185, "Ry_in": 1.288, "Ixe_in4": 20.204, "Sxe_in3": 3.824, "Mal_inkip": 75.57, "Mad_inkip": 66.4, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 2.232, "Cw_in6": 45.277, "Xo_in": -2.529, "m_in": 1.557, "Ro_in": 4.837, "beta_in": 0.727, "Lu_ft": 88.7},
    "1000S350-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.317, "weight_lbft": 4.48, "Ix_in4": 20.204, "Sx_in3": 4.041, "Rx_in": 3.917, "Iy_in4": 2.185, "Ry_in": 1.288, "Ixe_in4": 20.026, "Sxe_in3": 3.417, "Mal_inkip": 102.32, "Mad_inkip": 86.6, "Vag_lb": 3345.0, "Vnet_lb": 3345.0, "Jx1000_in4": 2.232, "Cw_in6": 45.277, "Xo_in": -2.529, "m_in": 1.557, "Ro_in": 4.837, "beta_in": 0.727, "Lu_ft": 72.0},
    "1000S350-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.855, "weight_lbft": 6.31, "Ix_in4": 28.148, "Sx_in3": 5.63, "Rx_in": 3.895, "Iy_in4": 2.992, "Ry_in": 1.27, "Ixe_in4": 28.148, "Sxe_in3": 5.517, "Mal_inkip": 120.332, "Mad_inkip": 112.8, "Vag_lb": 8843.0, "Vnet_lb": 6434.0, "Jx1000_in4": 6.397, "Cw_in6": 62.28, "Xo_in": -2.492, "m_in": 1.538, "Ro_in": 4.795, "beta_in": 0.73, "Lu_ft": 84.1},
    "1000S350-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.855, "weight_lbft": 6.31, "Ix_in4": 28.148, "Sx_in3": 5.63, "Rx_in": 3.895, "Iy_in4": 2.992, "Ry_in": 1.27, "Ixe_in4": 28.148, "Sxe_in3": 5.118, "Mal_inkip": 153.25, "Mad_inkip": 139.74, "Vag_lb": 9864.0, "Vnet_lb": 7177.0, "Jx1000_in4": 6.397, "Cw_in6": 62.28, "Xo_in": -2.492, "m_in": 1.538, "Ro_in": 4.795, "beta_in": 0.73, "Lu_ft": 71.6},
    "1000S350-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.245, "weight_lbft": 7.64, "Ix_in4": 33.772, "Sx_in3": 6.754, "Rx_in": 3.878, "Iy_in4": 3.543, "Ry_in": 1.256, "Ixe_in4": 33.772, "Sxe_in3": 6.754, "Mal_inkip": 150.232, "Mad_inkip": 147.03, "Vag_lb": 13189.0, "Vnet_lb": 7747.0, "Jx1000_in4": 11.544, "Cw_in6": 74.03, "Xo_in": -2.465, "m_in": 1.524, "Ro_in": 4.764, "beta_in": 0.732, "Lu_ft": 83.1},
    "1000S350-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.245, "weight_lbft": 7.64, "Ix_in4": 33.772, "Sx_in3": 6.754, "Rx_in": 3.878, "Iy_in4": 3.543, "Ry_in": 1.256, "Ixe_in4": 33.772, "Sxe_in3": 6.427, "Mal_inkip": 213.252, "Mad_inkip": 194.46, "Vag_lb": 16235.0, "Vnet_lb": 9536.0, "Jx1000_in4": 11.544, "Cw_in6": 74.03, "Xo_in": -2.465, "m_in": 1.524, "Ro_in": 4.764, "beta_in": 0.732, "Lu_ft": 67.8},
    "1200S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.896, "weight_lbft": 3.05, "Ix_in4": 15.73, "Sx_in3": 2.622, "Rx_in": 4.19, "Iy_in4": 0.212, "Ry_in": 0.486, "Ixe_in4": 14.743, "Sxe_in3": 2.109, "Mal_inkip": 41.68, "Mad_inkip": 36.38, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 0.957, "Cw_in6": 6.34, "Xo_in": -0.732, "m_in": 0.493, "Ro_in": 4.281, "beta_in": 0.971, "Lu_ft": 37.5},
    "1200S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.896, "weight_lbft": 3.05, "Ix_in4": 15.73, "Sx_in3": 2.622, "Rx_in": 4.19, "Iy_in4": 0.212, "Ry_in": 0.486, "Ixe_in4": 14.298, "Sxe_in3": 1.914, "Mal_inkip": 57.31, "Mad_inkip": 46.75, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 0.957, "Cw_in6": 6.34, "Xo_in": -0.732, "m_in": 0.493, "Ro_in": 4.281, "beta_in": 0.971, "Lu_ft": 30.5},
    "1200S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.121, "weight_lbft": 3.81, "Ix_in4": 19.518, "Sx_in3": 3.253, "Rx_in": 4.173, "Iy_in4": 0.255, "Ry_in": 0.477, "Ixe_in4": 18.955, "Sxe_in3": 2.817, "Mal_inkip": 55.66, "Mad_inkip": 50.95, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 1.899, "Cw_in6": 7.739, "Xo_in": -0.719, "m_in": 0.485, "Ro_in": 4.261, "beta_in": 0.972, "Lu_ft": 37.2},
    "1200S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.121, "weight_lbft": 3.81, "Ix_in4": 19.518, "Sx_in3": 3.253, "Rx_in": 4.173, "Iy_in4": 0.255, "Ry_in": 0.477, "Ixe_in4": 18.39, "Sxe_in3": 2.645, "Mal_inkip": 79.19, "Mad_inkip": 66.14, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 1.899, "Cw_in6": 7.739, "Xo_in": -0.719, "m_in": 0.485, "Ro_in": 4.261, "beta_in": 0.972, "Lu_ft": 30.2},
    "1200S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.576, "weight_lbft": 5.36, "Ix_in4": 26.966, "Sx_in3": 4.494, "Rx_in": 4.137, "Iy_in4": 0.331, "Ry_in": 0.459, "Ixe_in4": 26.966, "Sxe_in3": 4.327, "Mal_inkip": 85.51, "Mad_inkip": 83.86, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 5.433, "Cw_in6": 10.331, "Xo_in": -0.691, "m_in": 0.47, "Ro_in": 4.219, "beta_in": 0.973, "Lu_ft": 36.4},
    "1200S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.576, "weight_lbft": 5.36, "Ix_in4": 26.966, "Sx_in3": 4.494, "Rx_in": 4.137, "Iy_in4": 0.331, "Ry_in": 0.459, "Ixe_in4": 26.735, "Sxe_in3": 4.091, "Mal_inkip": 122.49, "Mad_inkip": 111.3, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 5.433, "Cw_in6": 10.331, "Xo_in": -0.691, "m_in": 0.47, "Ro_in": 4.219, "beta_in": 0.973, "Lu_ft": 29.5},
    "1200S162-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 1.904, "weight_lbft": 6.48, "Ix_in4": 32.145, "Sx_in3": 5.357, "Rx_in": 4.109, "Iy_in4": 0.376, "Ry_in": 0.444, "Ixe_in4": 32.145, "Sxe_in3": 5.357, "Mal_inkip": 105.87, "Mad_inkip": 105.87, "Vag_lb": 13189.0, "Vnet_lb": 9714.0, "Jx1000_in4": 9.788, "Cw_in6": 12.002, "Xo_in": -0.67, "m_in": 0.459, "Ro_in": 4.187, "beta_in": 0.974, "Lu_ft": 35.8},
    "1200S162-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 1.904, "weight_lbft": 6.48, "Ix_in4": 32.145, "Sx_in3": 5.357, "Rx_in": 4.109, "Iy_in4": 0.376, "Ry_in": 0.444, "Ixe_in4": 32.145, "Sxe_in3": 5.168, "Mal_inkip": 154.74, "Mad_inkip": 147.23, "Vag_lb": 14986.0, "Vnet_lb": 11037.0, "Jx1000_in4": 9.788, "Cw_in6": 12.002, "Xo_in": -0.67, "m_in": 0.459, "Ro_in": 4.187, "beta_in": 0.974, "Lu_ft": 29.0},
    "1200S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 0.953, "weight_lbft": 3.24, "Ix_in4": 17.662, "Sx_in3": 2.944, "Rx_in": 4.306, "Iy_in4": 0.393, "Ry_in": 0.643, "Ixe_in4": 16.678, "Sxe_in3": 2.425, "Mal_inkip": 47.93, "Mad_inkip": 42.47, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.017, "Cw_in6": 11.55, "Xo_in": -1.032, "m_in": 0.681, "Ro_in": 4.474, "beta_in": 0.947, "Lu_ft": 48.0},
    "1200S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 0.953, "weight_lbft": 3.24, "Ix_in4": 17.662, "Sx_in3": 2.944, "Rx_in": 4.306, "Iy_in4": 0.393, "Ry_in": 0.643, "Ixe_in4": 16.334, "Sxe_in3": 2.073, "Mal_inkip": 62.07, "Mad_inkip": 54.74, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.017, "Cw_in6": 11.55, "Xo_in": -1.032, "m_in": 0.681, "Ro_in": 4.474, "beta_in": 0.947, "Lu_ft": 39.0},
    "1200S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.192, "weight_lbft": 4.06, "Ix_in4": 21.947, "Sx_in3": 3.658, "Rx_in": 4.291, "Iy_in4": 0.479, "Ry_in": 0.634, "Ixe_in4": 21.376, "Sxe_in3": 3.215, "Mal_inkip": 63.54, "Mad_inkip": 58.83, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.02, "Cw_in6": 14.176, "Xo_in": -1.017, "m_in": 0.673, "Ro_in": 4.455, "beta_in": 0.948, "Lu_ft": 47.7},
    "1200S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.192, "weight_lbft": 4.06, "Ix_in4": 21.947, "Sx_in3": 3.658, "Rx_in": 4.291, "Iy_in4": 0.479, "Ry_in": 0.634, "Ixe_in4": 20.864, "Sxe_in3": 2.963, "Mal_inkip": 88.71, "Mad_inkip": 76.55, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.02, "Cw_in6": 14.176, "Xo_in": -1.017, "m_in": 0.673, "Ro_in": 4.455, "beta_in": 0.948, "Lu_ft": 38.7},
    "1200S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.677, "weight_lbft": 5.71, "Ix_in4": 30.417, "Sx_in3": 5.069, "Rx_in": 4.258, "Iy_in4": 0.635, "Ry_in": 0.615, "Ixe_in4": 30.417, "Sxe_in3": 4.899, "Mal_inkip": 96.81, "Mad_inkip": 95.43, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 5.783, "Cw_in6": 19.15, "Xo_in": -0.987, "m_in": 0.656, "Ro_in": 4.414, "beta_in": 0.95, "Lu_ft": 47.0},
    "1200S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.677, "weight_lbft": 5.71, "Ix_in4": 30.417, "Sx_in3": 5.069, "Rx_in": 4.258, "Iy_in4": 0.635, "Ry_in": 0.615, "Ixe_in4": 30.175, "Sxe_in3": 4.66, "Mal_inkip": 139.51, "Mad_inkip": 126.86, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 5.783, "Cw_in6": 19.15, "Xo_in": -0.987, "m_in": 0.656, "Ro_in": 4.414, "beta_in": 0.95, "Lu_ft": 38.1},
    "1200S200-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.028, "weight_lbft": 6.9, "Ix_in4": 36.347, "Sx_in3": 6.058, "Rx_in": 4.234, "Iy_in4": 0.732, "Ry_in": 0.601, "Ixe_in4": 36.347, "Sxe_in3": 6.058, "Mal_inkip": 119.71, "Mad_inkip": 119.71, "Vag_lb": 13189.0, "Vnet_lb": 9714.0, "Jx1000_in4": 10.427, "Cw_in6": 22.451, "Xo_in": -0.964, "m_in": 0.644, "Ro_in": 4.384, "beta_in": 0.952, "Lu_ft": 46.5},
    "1200S200-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.028, "weight_lbft": 6.9, "Ix_in4": 36.347, "Sx_in3": 6.058, "Rx_in": 4.234, "Iy_in4": 0.732, "Ry_in": 0.601, "Ixe_in4": 36.347, "Sxe_in3": 5.865, "Mal_inkip": 175.59, "Mad_inkip": 166.8, "Vag_lb": 14986.0, "Vnet_lb": 11037.0, "Jx1000_in4": 10.427, "Cw_in6": 22.451, "Xo_in": -0.964, "m_in": 0.644, "Ro_in": 4.384, "beta_in": 0.952, "Lu_ft": 37.7},
    "1200S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.009, "weight_lbft": 3.43, "Ix_in4": 19.681, "Sx_in3": 3.28, "Rx_in": 4.416, "Iy_in4": 0.683, "Ry_in": 0.823, "Ixe_in4": 18.832, "Sxe_in3": 2.482, "Mal_inkip": 49.05, "Mad_inkip": 45.43, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.078, "Cw_in6": 19.505, "Xo_in": -1.378, "m_in": 0.892, "Ro_in": 4.699, "beta_in": 0.914, "Lu_ft": 59.6},
    "1200S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.009, "weight_lbft": 3.43, "Ix_in4": 19.681, "Sx_in3": 3.28, "Rx_in": 4.416, "Iy_in4": 0.683, "Ry_in": 0.823, "Ixe_in4": 18.433, "Sxe_in3": 2.149, "Mal_inkip": 64.34, "Mad_inkip": 58.39, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.078, "Cw_in6": 19.505, "Xo_in": -1.378, "m_in": 0.892, "Ro_in": 4.699, "beta_in": 0.914, "Lu_ft": 48.3},
    "1200S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.263, "weight_lbft": 4.3, "Ix_in4": 24.484, "Sx_in3": 4.081, "Rx_in": 4.402, "Iy_in4": 0.836, "Ry_in": 0.813, "Ixe_in4": 23.963, "Sxe_in3": 3.496, "Mal_inkip": 69.08, "Mad_inkip": 62.95, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.141, "Cw_in6": 24.034, "Xo_in": -1.362, "m_in": 0.884, "Ro_in": 4.679, "beta_in": 0.915, "Lu_ft": 59.2},
    "1200S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.263, "weight_lbft": 4.3, "Ix_in4": 24.484, "Sx_in3": 4.081, "Rx_in": 4.402, "Iy_in4": 0.836, "Ry_in": 0.813, "Ixe_in4": 23.575, "Sxe_in3": 3.007, "Mal_inkip": 90.04, "Mad_inkip": 81.59, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.141, "Cw_in6": 24.034, "Xo_in": -1.362, "m_in": 0.884, "Ro_in": 4.679, "beta_in": 0.915, "Lu_ft": 48.1},
    "1200S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 34.016, "Sx_in3": 5.669, "Rx_in": 4.373, "Iy_in4": 1.121, "Ry_in": 0.794, "Ixe_in4": 34.016, "Sxe_in3": 5.496, "Mal_inkip": 108.6, "Mad_inkip": 102.52, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 6.134, "Cw_in6": 32.734, "Xo_in": -1.329, "m_in": 0.867, "Ro_in": 4.639, "beta_in": 0.918, "Lu_ft": 58.6},
    "1200S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 34.016, "Sx_in3": 5.669, "Rx_in": 4.373, "Iy_in4": 1.121, "Ry_in": 0.794, "Ixe_in4": 33.835, "Sxe_in3": 5.037, "Mal_inkip": 150.82, "Mad_inkip": 135.37, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 6.134, "Cw_in6": 32.734, "Xo_in": -1.329, "m_in": 0.867, "Ro_in": 4.639, "beta_in": 0.918, "Lu_ft": 47.5},
    "1200S250-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.152, "weight_lbft": 7.32, "Ix_in4": 40.726, "Sx_in3": 6.788, "Rx_in": 4.35, "Iy_in4": 1.307, "Ry_in": 0.779, "Ixe_in4": 40.726, "Sxe_in3": 6.788, "Mal_inkip": 134.13, "Mad_inkip": 133.19, "Vag_lb": 13189.0, "Vnet_lb": 9714.0, "Jx1000_in4": 11.065, "Cw_in6": 38.619, "Xo_in": -1.305, "m_in": 0.854, "Ro_in": 4.608, "beta_in": 0.92, "Lu_ft": 58.2},
    "1200S250-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.152, "weight_lbft": 7.32, "Ix_in4": 40.726, "Sx_in3": 6.788, "Rx_in": 4.35, "Iy_in4": 1.307, "Ry_in": 0.779, "Ixe_in4": 40.726, "Sxe_in3": 6.541, "Mal_inkip": 195.84, "Mad_inkip": 178.57, "Vag_lb": 14986.0, "Vnet_lb": 11037.0, "Jx1000_in4": 11.065, "Cw_in6": 38.619, "Xo_in": -1.305, "m_in": 0.854, "Ro_in": 4.608, "beta_in": 0.92, "Lu_ft": 47.1},
    "1200S300-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.066, "weight_lbft": 3.63, "Ix_in4": 21.699, "Sx_in3": 3.617, "Rx_in": 4.512, "Iy_in4": 1.074, "Ry_in": 1.004, "Ixe_in4": 21.648, "Sxe_in3": 2.736, "Mal_inkip": 54.06, "Mad_inkip": 47.36, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.138, "Cw_in6": 30.051, "Xo_in": -1.743, "m_in": 1.111, "Ro_in": 4.94, "beta_in": 0.876, "Lu_ft": 70.8},
    "1200S300-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.066, "weight_lbft": 3.63, "Ix_in4": 21.699, "Sx_in3": 3.617, "Rx_in": 4.512, "Iy_in4": 1.074, "Ry_in": 1.004, "Ixe_in4": 21.043, "Sxe_in3": 2.272, "Mal_inkip": 68.04, "Mad_inkip": 60.65, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.138, "Cw_in6": 30.051, "Xo_in": -1.743, "m_in": 1.111, "Ro_in": 4.94, "beta_in": 0.876, "Lu_ft": 57.4},
    "1200S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.335, "weight_lbft": 4.54, "Ix_in4": 27.02, "Sx_in3": 4.503, "Rx_in": 4.499, "Iy_in4": 1.32, "Ry_in": 0.994, "Ixe_in4": 26.918, "Sxe_in3": 4.064, "Mal_inkip": 80.3, "Mad_inkip": 65.72, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.262, "Cw_in6": 37.126, "Xo_in": -1.726, "m_in": 1.103, "Ro_in": 4.921, "beta_in": 0.877, "Lu_ft": 70.5},
    "1200S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.335, "weight_lbft": 4.54, "Ix_in4": 27.02, "Sx_in3": 4.503, "Rx_in": 4.499, "Iy_in4": 1.32, "Ry_in": 0.994, "Ixe_in4": 26.51, "Sxe_in3": 3.317, "Mal_inkip": 99.32, "Mad_inkip": 84.79, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.262, "Cw_in6": 37.126, "Xo_in": -1.726, "m_in": 1.103, "Ro_in": 4.921, "beta_in": 0.877, "Lu_ft": 57.2},
    "1200S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.881, "weight_lbft": 6.4, "Ix_in4": 37.616, "Sx_in3": 6.269, "Rx_in": 4.472, "Iy_in4": 1.786, "Ry_in": 0.974, "Ixe_in4": 37.616, "Sxe_in3": 6.035, "Mal_inkip": 133.592, "Mad_inkip": 116.06, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 6.484, "Cw_in6": 50.853, "Xo_in": -1.691, "m_in": 1.085, "Ro_in": 4.88, "beta_in": 0.88, "Lu_ft": 66.0},
    "1200S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.881, "weight_lbft": 6.4, "Ix_in4": 37.616, "Sx_in3": 6.269, "Rx_in": 4.472, "Iy_in4": 1.786, "Ry_in": 0.974, "Ixe_in4": 37.085, "Sxe_in3": 5.831, "Mal_inkip": 174.57, "Mad_inkip": 141.05, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 6.484, "Cw_in6": 50.853, "Xo_in": -1.691, "m_in": 1.085, "Ro_in": 4.88, "beta_in": 0.88, "Lu_ft": 56.7},
    "1200S300-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.276, "weight_lbft": 7.75, "Ix_in4": 45.106, "Sx_in3": 7.518, "Rx_in": 4.452, "Iy_in4": 2.095, "Ry_in": 0.959, "Ixe_in4": 45.106, "Sxe_in3": 7.323, "Mal_inkip": 165.762, "Mad_inkip": 154.65, "Vag_lb": 13189.0, "Vnet_lb": 9714.0, "Jx1000_in4": 11.704, "Cw_in6": 60.251, "Xo_in": -1.666, "m_in": 1.071, "Ro_in": 4.849, "beta_in": 0.882, "Lu_ft": 64.9},
    "1200S300-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.276, "weight_lbft": 7.75, "Ix_in4": 45.106, "Sx_in3": 7.518, "Rx_in": 4.452, "Iy_in4": 2.095, "Ry_in": 0.959, "Ixe_in4": 44.727, "Sxe_in3": 7.232, "Mal_inkip": 243.672, "Mad_inkip": 201.68, "Vag_lb": 14986.0, "Vnet_lb": 11037.0, "Jx1000_in4": 11.704, "Cw_in6": 60.251, "Xo_in": -1.666, "m_in": 1.071, "Ro_in": 4.849, "beta_in": 0.882, "Lu_ft": 53.0},
    "1200S350-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.165, "weight_lbft": 3.96, "Ix_in4": 24.86, "Sx_in3": 4.143, "Rx_in": 4.62, "Iy_in4": 1.866, "Ry_in": 1.266, "Ixe_in4": 24.61, "Sxe_in3": 3.295, "Mal_inkip": 65.12, "Mad_inkip": 58.95, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.244, "Cw_in6": 54.279, "Xo_in": -2.363, "m_in": 1.478, "Ro_in": 5.341, "beta_in": 0.804, "Lu_ft": 88.0},
    "1200S350-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.165, "weight_lbft": 3.96, "Ix_in4": 24.86, "Sx_in3": 4.143, "Rx_in": 4.62, "Iy_in4": 1.866, "Ry_in": 1.266, "Ixe_in4": 24.087, "Sxe_in3": 2.787, "Mal_inkip": 83.46, "Mad_inkip": 75.92, "Vag_lb": 1377.0, "Vnet_lb": 1377.0, "Jx1000_in4": 1.244, "Cw_in6": 54.279, "Xo_in": -2.363, "m_in": 1.478, "Ro_in": 5.341, "beta_in": 0.804, "Lu_ft": 71.4},
    "1200S350-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.46, "weight_lbft": 4.97, "Ix_in4": 30.996, "Sx_in3": 5.166, "Rx_in": 4.608, "Iy_in4": 2.306, "Ry_in": 1.257, "Ixe_in4": 30.996, "Sxe_in3": 4.908, "Mal_inkip": 96.98, "Mad_inkip": 80.83, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.473, "Cw_in6": 67.251, "Xo_in": -2.346, "m_in": 1.469, "Ro_in": 5.322, "beta_in": 0.806, "Lu_ft": 87.7},
    "1200S350-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.46, "weight_lbft": 4.97, "Ix_in4": 30.996, "Sx_in3": 5.166, "Rx_in": 4.608, "Iy_in4": 2.306, "Ry_in": 1.257, "Ixe_in4": 30.916, "Sxe_in3": 4.061, "Mal_inkip": 121.59, "Mad_inkip": 104.89, "Vag_lb": 2771.0, "Vnet_lb": 2771.0, "Jx1000_in4": 2.473, "Cw_in6": 67.251, "Xo_in": -2.346, "m_in": 1.469, "Ro_in": 5.322, "beta_in": 0.806, "Lu_ft": 71.2},
    "1200S350-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 2.059, "weight_lbft": 7.01, "Ix_in4": 43.269, "Sx_in3": 7.211, "Rx_in": 4.584, "Iy_in4": 3.159, "Ry_in": 1.239, "Ixe_in4": 43.269, "Sxe_in3": 7.071, "Mal_inkip": 154.222, "Mad_inkip": 138.56, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 7.098, "Cw_in6": 92.672, "Xo_in": -2.31, "m_in": 1.45, "Ro_in": 5.281, "beta_in": 0.809, "Lu_ft": 83.0},
    "1200S350-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 2.059, "weight_lbft": 7.01, "Ix_in4": 43.269, "Sx_in3": 7.211, "Rx_in": 4.584, "Iy_in4": 3.159, "Ry_in": 1.239, "Ixe_in4": 43.269, "Sxe_in3": 6.59, "Mal_inkip": 197.31, "Mad_inkip": 170.84, "Vag_lb": 8147.0, "Vnet_lb": 7411.0, "Jx1000_in4": 7.098, "Cw_in6": 92.672, "Xo_in": -2.31, "m_in": 1.45, "Ro_in": 5.281, "beta_in": 0.809, "Lu_ft": 70.8},
    "1200S350-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.494, "weight_lbft": 8.48, "Ix_in4": 51.992, "Sx_in3": 8.665, "Rx_in": 4.566, "Iy_in4": 3.741, "Ry_in": 1.225, "Ixe_in4": 51.992, "Sxe_in3": 8.665, "Mal_inkip": 192.742, "Mad_inkip": 181.9, "Vag_lb": 13189.0, "Vnet_lb": 9714.0, "Jx1000_in4": 12.821, "Cw_in6": 110.302, "Xo_in": -2.284, "m_in": 1.436, "Ro_in": 5.25, "beta_in": 0.811, "Lu_ft": 81.9},
    "1200S350-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.494, "weight_lbft": 8.48, "Ix_in4": 51.992, "Sx_in3": 8.665, "Rx_in": 4.566, "Iy_in4": 3.741, "Ry_in": 1.225, "Ixe_in4": 51.992, "Sxe_in3": 8.26, "Mal_inkip": 274.072, "Mad_inkip": 238.96, "Vag_lb": 14986.0, "Vnet_lb": 11037.0, "Jx1000_in4": 12.821, "Cw_in6": 110.302, "Xo_in": -2.284, "m_in": 1.436, "Ro_in": 5.25, "beta_in": 0.811, "Lu_ft": 66.9},
    "1400S162-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.009, "weight_lbft": 3.43, "Ix_in4": 23.302, "Sx_in3": 3.329, "Rx_in": 4.805, "Iy_in4": 0.218, "Ry_in": 0.464, "Ixe_in4": 21.103, "Sxe_in3": 2.496, "Mal_inkip": 49.32, "Mad_inkip": 40.86, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.078, "Cw_in6": 8.98, "Xo_in": -0.667, "m_in": 0.454, "Ro_in": 4.873, "beta_in": 0.981, "Lu_ft": 36.6},
    "1400S162-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.009, "weight_lbft": 3.43, "Ix_in4": 23.302, "Sx_in3": 3.329, "Rx_in": 4.805, "Iy_in4": 0.218, "Ry_in": 0.464, "Ixe_in4": 20.365, "Sxe_in3": 2.256, "Mal_inkip": 67.54, "Mad_inkip": 52.13, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.078, "Cw_in6": 8.98, "Xo_in": -0.667, "m_in": 0.454, "Ro_in": 4.873, "beta_in": 0.981, "Lu_ft": 29.7},
    "1400S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.263, "weight_lbft": 4.3, "Ix_in4": 28.952, "Sx_in3": 4.136, "Rx_in": 4.787, "Iy_in4": 0.262, "Ry_in": 0.456, "Ixe_in4": 27.357, "Sxe_in3": 3.357, "Mal_inkip": 66.33, "Mad_inkip": 57.96, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.141, "Cw_in6": 10.966, "Xo_in": -0.654, "m_in": 0.447, "Ro_in": 4.853, "beta_in": 0.982, "Lu_ft": 36.2},
    "1400S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.263, "weight_lbft": 4.3, "Ix_in4": 28.952, "Sx_in3": 4.136, "Rx_in": 4.787, "Iy_in4": 0.262, "Ry_in": 0.456, "Ixe_in4": 26.375, "Sxe_in3": 3.135, "Mal_inkip": 93.85, "Mad_inkip": 74.56, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.141, "Cw_in6": 10.966, "Xo_in": -0.654, "m_in": 0.447, "Ro_in": 4.853, "beta_in": 0.982, "Lu_ft": 29.4},
    "1400S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 40.115, "Sx_in3": 5.731, "Rx_in": 4.748, "Iy_in4": 0.34, "Ry_in": 0.437, "Ixe_in4": 39.965, "Sxe_in3": 5.248, "Mal_inkip": 103.71, "Mad_inkip": 97.69, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 6.134, "Cw_in6": 14.651, "Xo_in": -0.628, "m_in": 0.433, "Ro_in": 4.81, "beta_in": 0.983, "Lu_ft": 35.3},
    "1400S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.779, "weight_lbft": 6.05, "Ix_in4": 40.115, "Sx_in3": 5.731, "Rx_in": 4.748, "Iy_in4": 0.34, "Ry_in": 0.437, "Ixe_in4": 38.897, "Sxe_in3": 4.915, "Mal_inkip": 147.14, "Mad_inkip": 127.96, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 6.134, "Cw_in6": 14.651, "Xo_in": -0.628, "m_in": 0.433, "Ro_in": 4.81, "beta_in": 0.983, "Lu_ft": 28.7},
    "1400S162-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.152, "weight_lbft": 7.32, "Ix_in4": 47.928, "Sx_in3": 6.847, "Rx_in": 4.719, "Iy_in4": 0.385, "Ry_in": 0.423, "Ixe_in4": 47.928, "Sxe_in3": 6.659, "Mal_inkip": 131.59, "Mad_inkip": 129.07, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 11.065, "Cw_in6": 17.032, "Xo_in": -0.609, "m_in": 0.422, "Ro_in": 4.777, "beta_in": 0.984, "Lu_ft": 34.7},
    "1400S162-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.152, "weight_lbft": 7.32, "Ix_in4": 47.928, "Sx_in3": 6.847, "Rx_in": 4.719, "Iy_in4": 0.385, "Ry_in": 0.423, "Ixe_in4": 47.772, "Sxe_in3": 6.282, "Mal_inkip": 188.07, "Mad_inkip": 171.63, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 11.065, "Cw_in6": 17.032, "Xo_in": -0.609, "m_in": 0.422, "Ro_in": 4.777, "beta_in": 0.984, "Lu_ft": 28.1},
    "1400S200-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.066, "weight_lbft": 3.63, "Ix_in4": 25.951, "Sx_in3": 3.707, "Rx_in": 4.935, "Iy_in4": 0.406, "Ry_in": 0.617, "Ixe_in4": 23.767, "Sxe_in3": 2.866, "Mal_inkip": 56.63, "Mad_inkip": 48.18, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.138, "Cw_in6": 16.355, "Xo_in": -0.946, "m_in": 0.633, "Ro_in": 5.062, "beta_in": 0.965, "Lu_ft": 47.0},
    "1400S200-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.066, "weight_lbft": 3.63, "Ix_in4": 25.951, "Sx_in3": 3.707, "Rx_in": 4.935, "Iy_in4": 0.406, "Ry_in": 0.617, "Ixe_in4": 23.199, "Sxe_in3": 2.44, "Mal_inkip": 73.05, "Mad_inkip": 61.67, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.138, "Cw_in6": 16.355, "Xo_in": -0.946, "m_in": 0.633, "Ro_in": 5.062, "beta_in": 0.965, "Lu_ft": 38.2},
    "1400S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.335, "weight_lbft": 4.54, "Ix_in4": 32.284, "Sx_in3": 4.612, "Rx_in": 4.918, "Iy_in4": 0.494, "Ry_in": 0.608, "Ixe_in4": 30.684, "Sxe_in3": 3.824, "Mal_inkip": 75.56, "Mad_inkip": 67.5, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.262, "Cw_in6": 20.083, "Xo_in": -0.932, "m_in": 0.625, "Ro_in": 5.043, "beta_in": 0.966, "Lu_ft": 46.7},
    "1400S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.335, "weight_lbft": 4.54, "Ix_in4": 32.284, "Sx_in3": 4.612, "Rx_in": 4.918, "Iy_in4": 0.494, "Ry_in": 0.608, "Ixe_in4": 29.797, "Sxe_in3": 3.505, "Mal_inkip": 104.93, "Mad_inkip": 87.1, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.262, "Cw_in6": 20.083, "Xo_in": -0.932, "m_in": 0.625, "Ro_in": 5.043, "beta_in": 0.966, "Lu_ft": 37.9},
    "1400S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.881, "weight_lbft": 6.4, "Ix_in4": 44.853, "Sx_in3": 6.408, "Rx_in": 4.883, "Iy_in4": 0.655, "Ry_in": 0.59, "Ixe_in4": 44.683, "Sxe_in3": 5.917, "Mal_inkip": 116.93, "Mad_inkip": 111.87, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 6.484, "Cw_in6": 27.156, "Xo_in": -0.904, "m_in": 0.609, "Ro_in": 5.001, "beta_in": 0.967, "Lu_ft": 45.9},
    "1400S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.881, "weight_lbft": 6.4, "Ix_in4": 44.853, "Sx_in3": 6.408, "Rx_in": 4.883, "Iy_in4": 0.655, "Ry_in": 0.59, "Ixe_in4": 43.616, "Sxe_in3": 5.58, "Mal_inkip": 167.07, "Mad_inkip": 146.98, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 6.484, "Cw_in6": 27.156, "Xo_in": -0.904, "m_in": 0.609, "Ro_in": 5.001, "beta_in": 0.967, "Lu_ft": 37.3},
    "1400S200-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.276, "weight_lbft": 7.75, "Ix_in4": 53.698, "Sx_in3": 7.671, "Rx_in": 4.857, "Iy_in4": 0.755, "Ry_in": 0.576, "Ixe_in4": 53.698, "Sxe_in3": 7.48, "Mal_inkip": 147.81, "Mad_inkip": 146.71, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 11.704, "Cw_in6": 31.861, "Xo_in": -0.883, "m_in": 0.598, "Ro_in": 4.97, "beta_in": 0.968, "Lu_ft": 45.4},
    "1400S200-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.276, "weight_lbft": 7.75, "Ix_in4": 53.698, "Sx_in3": 7.671, "Rx_in": 4.857, "Iy_in4": 0.755, "Ry_in": 0.576, "Ixe_in4": 53.52, "Sxe_in3": 7.096, "Mal_inkip": 212.47, "Mad_inkip": 195.62, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 11.704, "Cw_in6": 31.861, "Xo_in": -0.883, "m_in": 0.598, "Ro_in": 4.97, "beta_in": 0.968, "Lu_ft": 36.8},
    "1400S250-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.122, "weight_lbft": 3.82, "Ix_in4": 28.702, "Sx_in3": 4.1, "Rx_in": 5.057, "Iy_in4": 0.707, "Ry_in": 0.794, "Ixe_in4": 26.758, "Sxe_in3": 2.927, "Mal_inkip": 57.83, "Mad_inkip": 52.08, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.198, "Cw_in6": 27.675, "Xo_in": -1.272, "m_in": 0.835, "Ro_in": 5.275, "beta_in": 0.942, "Lu_ft": 58.6},
    "1400S250-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.122, "weight_lbft": 3.82, "Ix_in4": 28.702, "Sx_in3": 4.1, "Rx_in": 5.057, "Iy_in4": 0.707, "Ry_in": 0.794, "Ixe_in4": 26.141, "Sxe_in3": 2.527, "Mal_inkip": 75.65, "Mad_inkip": 66.58, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.198, "Cw_in6": 27.675, "Xo_in": -1.272, "m_in": 0.835, "Ro_in": 5.275, "beta_in": 0.942, "Lu_ft": 47.6},
    "1400S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.406, "weight_lbft": 4.78, "Ix_in4": 35.743, "Sx_in3": 5.106, "Rx_in": 5.042, "Iy_in4": 0.865, "Ry_in": 0.784, "Ixe_in4": 34.239, "Sxe_in3": 4.145, "Mal_inkip": 81.9, "Mad_inkip": 72.82, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.383, "Cw_in6": 34.118, "Xo_in": -1.257, "m_in": 0.827, "Ro_in": 5.255, "beta_in": 0.943, "Lu_ft": 58.3},
    "1400S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.406, "weight_lbft": 4.78, "Ix_in4": 35.743, "Sx_in3": 5.106, "Rx_in": 5.042, "Iy_in4": 0.865, "Ry_in": 0.784, "Ixe_in4": 33.565, "Sxe_in3": 3.55, "Mal_inkip": 106.29, "Mad_inkip": 93.79, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.383, "Cw_in6": 34.118, "Xo_in": -1.257, "m_in": 0.827, "Ro_in": 5.255, "beta_in": 0.943, "Lu_ft": 47.3},
    "1400S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.983, "weight_lbft": 6.75, "Ix_in4": 49.764, "Sx_in3": 7.109, "Rx_in": 5.01, "Iy_in4": 1.16, "Ry_in": 0.765, "Ixe_in4": 49.579, "Sxe_in3": 6.611, "Mal_inkip": 130.64, "Mad_inkip": 120.65, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 6.835, "Cw_in6": 46.52, "Xo_in": -1.225, "m_in": 0.811, "Ro_in": 5.214, "beta_in": 0.945, "Lu_ft": 57.6},
    "1400S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.983, "weight_lbft": 6.75, "Ix_in4": 49.764, "Sx_in3": 7.109, "Rx_in": 5.01, "Iy_in4": 1.16, "Ry_in": 0.765, "Ixe_in4": 48.65, "Sxe_in3": 6.01, "Mal_inkip": 179.95, "Mad_inkip": 157.94, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 6.835, "Cw_in6": 46.52, "Xo_in": -1.225, "m_in": 0.811, "Ro_in": 5.214, "beta_in": 0.945, "Lu_ft": 46.7},
    "1400S250-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.4, "weight_lbft": 8.17, "Ix_in4": 59.676, "Sx_in3": 8.525, "Rx_in": 4.986, "Iy_in4": 1.352, "Ry_in": 0.75, "Ixe_in4": 59.676, "Sxe_in3": 8.33, "Mal_inkip": 164.61, "Mad_inkip": 158.62, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 12.342, "Cw_in6": 54.927, "Xo_in": -1.203, "m_in": 0.798, "Ro_in": 5.184, "beta_in": 0.946, "Lu_ft": 57.1},
    "1400S250-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.4, "weight_lbft": 8.17, "Ix_in4": 59.676, "Sx_in3": 8.525, "Rx_in": 4.986, "Iy_in4": 1.352, "Ry_in": 0.75, "Ixe_in4": 59.504, "Sxe_in3": 7.881, "Mal_inkip": 235.94, "Mad_inkip": 210.42, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 12.342, "Cw_in6": 54.927, "Xo_in": -1.203, "m_in": 0.798, "Ro_in": 5.184, "beta_in": 0.946, "Lu_ft": 46.2},
    "1400S300-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.179, "weight_lbft": 4.01, "Ix_in4": 31.453, "Sx_in3": 4.493, "Rx_in": 5.165, "Iy_in4": 1.115, "Ry_in": 0.972, "Ixe_in4": 29.581, "Sxe_in3": 3.019, "Mal_inkip": 59.66, "Mad_inkip": 54.74, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.259, "Cw_in6": 42.69, "Xo_in": -1.617, "m_in": 1.046, "Ro_in": 5.499, "beta_in": 0.914, "Lu_ft": 69.9},
    "1400S300-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.179, "weight_lbft": 4.01, "Ix_in4": 31.453, "Sx_in3": 4.493, "Rx_in": 5.165, "Iy_in4": 1.115, "Ry_in": 0.972, "Ixe_in4": 27.227, "Sxe_in3": 2.58, "Mal_inkip": 77.25, "Mad_inkip": 69.82, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.259, "Cw_in6": 42.69, "Xo_in": -1.617, "m_in": 1.046, "Ro_in": 5.499, "beta_in": 0.914, "Lu_ft": 56.8},
    "1400S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.477, "weight_lbft": 5.03, "Ix_in4": 39.201, "Sx_in3": 5.6, "Rx_in": 5.151, "Iy_in4": 1.37, "Ry_in": 0.963, "Ixe_in4": 37.902, "Sxe_in3": 4.236, "Mal_inkip": 83.71, "Mad_inkip": 76.51, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.503, "Cw_in6": 52.772, "Xo_in": -1.601, "m_in": 1.038, "Ro_in": 5.48, "beta_in": 0.915, "Lu_ft": 69.6},
    "1400S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.477, "weight_lbft": 5.03, "Ix_in4": 39.201, "Sx_in3": 5.6, "Rx_in": 5.151, "Iy_in4": 1.37, "Ry_in": 0.963, "Ixe_in4": 36.29, "Sxe_in3": 3.655, "Mal_inkip": 109.42, "Mad_inkip": 98.25, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.503, "Cw_in6": 52.772, "Xo_in": -1.601, "m_in": 1.038, "Ro_in": 5.48, "beta_in": 0.915, "Lu_ft": 56.5},
    "1400S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 2.084, "weight_lbft": 7.09, "Ix_in4": 54.675, "Sx_in3": 7.811, "Rx_in": 5.122, "Iy_in4": 1.854, "Ry_in": 0.943, "Ixe_in4": 54.574, "Sxe_in3": 7.035, "Mal_inkip": 139.02, "Mad_inkip": 126.99, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 7.186, "Cw_in6": 72.365, "Xo_in": -1.568, "m_in": 1.02, "Ro_in": 5.439, "beta_in": 0.917, "Lu_ft": 68.9},
    "1400S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 2.084, "weight_lbft": 7.09, "Ix_in4": 54.675, "Sx_in3": 7.811, "Rx_in": 5.122, "Iy_in4": 1.854, "Ry_in": 0.943, "Ixe_in4": 53.226, "Sxe_in3": 6.372, "Mal_inkip": 190.78, "Mad_inkip": 165.45, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 7.186, "Cw_in6": 72.365, "Xo_in": -1.568, "m_in": 1.02, "Ro_in": 5.439, "beta_in": 0.917, "Lu_ft": 55.9},
    "1400S300-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.525, "weight_lbft": 8.59, "Ix_in4": 65.655, "Sx_in3": 9.379, "Rx_in": 5.1, "Iy_in4": 2.174, "Ry_in": 0.928, "Ixe_in4": 65.655, "Sxe_in3": 9.046, "Mal_inkip": 178.75, "Mad_inkip": 167.53, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 12.981, "Cw_in6": 85.812, "Xo_in": -1.544, "m_in": 1.008, "Ro_in": 5.408, "beta_in": 0.919, "Lu_ft": 68.5},
    "1400S300-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.525, "weight_lbft": 8.59, "Ix_in4": 65.655, "Sx_in3": 9.379, "Rx_in": 5.1, "Iy_in4": 2.174, "Ry_in": 0.928, "Ixe_in4": 65.57, "Sxe_in3": 8.427, "Mal_inkip": 252.29, "Mad_inkip": 220.81, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 12.981, "Cw_in6": 85.812, "Xo_in": -1.544, "m_in": 1.008, "Ro_in": 5.408, "beta_in": 0.919, "Lu_ft": 55.5},
    "1400S350-54_33ksi": {"thickness_in": 0.0566, "Fy_ksi": 33.0, "area_in2": 1.278, "weight_lbft": 4.35, "Ix_in4": 35.83, "Sx_in3": 5.119, "Rx_in": 5.295, "Iy_in4": 1.947, "Ry_in": 1.234, "Ixe_in4": 35.659, "Sxe_in3": 3.823, "Mal_inkip": 75.54, "Mad_inkip": 68.8, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.365, "Cw_in6": 76.252, "Xo_in": -2.207, "m_in": 1.4, "Ro_in": 5.868, "beta_in": 0.859, "Lu_ft": 87.1},
    "1400S350-54_50ksi": {"thickness_in": 0.0566, "Fy_ksi": 50.0, "area_in2": 1.278, "weight_lbft": 4.35, "Ix_in4": 35.83, "Sx_in3": 5.119, "Rx_in": 5.295, "Iy_in4": 1.947, "Ry_in": 1.234, "Ixe_in4": 33.308, "Sxe_in3": 3.249, "Mal_inkip": 97.27, "Mad_inkip": 88.25, "Vag_lb": 1177.0, "Vnet_lb": 1177.0, "Jx1000_in4": 1.365, "Cw_in6": 76.252, "Xo_in": -2.207, "m_in": 1.4, "Ro_in": 5.868, "beta_in": 0.859, "Lu_ft": 70.7},
    "1400S350-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.602, "weight_lbft": 5.45, "Ix_in4": 44.707, "Sx_in3": 6.387, "Rx_in": 5.283, "Iy_in4": 2.406, "Ry_in": 1.226, "Ixe_in4": 44.707, "Sxe_in3": 5.7, "Mal_inkip": 112.64, "Mad_inkip": 94.81, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.715, "Cw_in6": 94.534, "Xo_in": -2.19, "m_in": 1.391, "Ro_in": 5.848, "beta_in": 0.86, "Lu_ft": 86.8},
    "1400S350-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.602, "weight_lbft": 5.45, "Ix_in4": 44.707, "Sx_in3": 6.387, "Rx_in": 5.283, "Iy_in4": 2.406, "Ry_in": 1.226, "Ixe_in4": 44.707, "Sxe_in3": 4.709, "Mal_inkip": 141.0, "Mad_inkip": 122.49, "Vag_lb": 2365.0, "Vnet_lb": 2365.0, "Jx1000_in4": 2.715, "Cw_in6": 94.534, "Xo_in": -2.19, "m_in": 1.391, "Ro_in": 5.848, "beta_in": 0.86, "Lu_ft": 70.4},
    "1400S350-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 2.262, "weight_lbft": 7.7, "Ix_in4": 62.507, "Sx_in3": 8.93, "Rx_in": 5.257, "Iy_in4": 3.296, "Ry_in": 1.207, "Ixe_in4": 62.507, "Sxe_in3": 8.762, "Mal_inkip": 191.082, "Mad_inkip": 163.95, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 7.799, "Cw_in6": 130.43, "Xo_in": -2.156, "m_in": 1.373, "Ro_in": 5.808, "beta_in": 0.862, "Lu_ft": 82.0},
    "1400S350-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 2.262, "weight_lbft": 7.7, "Ix_in4": 62.507, "Sx_in3": 8.93, "Rx_in": 5.257, "Iy_in4": 3.296, "Ry_in": 1.207, "Ixe_in4": 62.507, "Sxe_in3": 8.189, "Mal_inkip": 245.18, "Mad_inkip": 201.25, "Vag_lb": 6939.0, "Vnet_lb": 6939.0, "Jx1000_in4": 7.799, "Cw_in6": 130.43, "Xo_in": -2.156, "m_in": 1.373, "Ro_in": 5.808, "beta_in": 0.862, "Lu_ft": 70.0},
    "1400S350-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.742, "weight_lbft": 9.33, "Ix_in4": 75.2, "Sx_in3": 10.743, "Rx_in": 5.237, "Iy_in4": 3.903, "Ry_in": 1.193, "Ixe_in4": 75.2, "Sxe_in3": 10.743, "Mal_inkip": 238.952, "Mad_inkip": 216.66, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 14.099, "Cw_in6": 155.387, "Xo_in": -2.13, "m_in": 1.36, "Ro_in": 5.778, "beta_in": 0.864, "Lu_ft": 80.9},
    "1400S350-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.742, "weight_lbft": 9.33, "Ix_in4": 75.2, "Sx_in3": 10.743, "Rx_in": 5.237, "Iy_in4": 3.903, "Ry_in": 1.193, "Ixe_in4": 75.2, "Sxe_in3": 10.26, "Mal_inkip": 340.442, "Mad_inkip": 282.84, "Vag_lb": 12745.0, "Vnet_lb": 11287.0, "Jx1000_in4": 14.099, "Cw_in6": 155.387, "Xo_in": -2.13, "m_in": 1.36, "Ro_in": 5.778, "beta_in": 0.864, "Lu_ft": 66.1},
    "1600S162-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.406, "weight_lbft": 4.78, "Ix_in4": 40.913, "Sx_in3": 5.114, "Rx_in": 5.394, "Iy_in4": 0.268, "Ry_in": 0.436, "Ixe_in4": 37.533, "Sxe_in3": 3.896, "Mal_inkip": 76.99, "Mad_inkip": 64.1, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.383, "Cw_in6": 14.816, "Xo_in": -0.601, "m_in": 0.415, "Ro_in": 5.445, "beta_in": 0.988, "Lu_ft": 35.2},
    "1600S162-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.406, "weight_lbft": 4.78, "Ix_in4": 40.913, "Sx_in3": 5.114, "Rx_in": 5.394, "Iy_in4": 0.268, "Ry_in": 0.436, "Ixe_in4": 35.986, "Sxe_in3": 3.624, "Mal_inkip": 108.49, "Mad_inkip": 81.87, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.383, "Cw_in6": 14.816, "Xo_in": -0.601, "m_in": 0.415, "Ro_in": 5.445, "beta_in": 0.988, "Lu_ft": 28.6},
    "1600S162-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 1.983, "weight_lbft": 6.75, "Ix_in4": 56.824, "Sx_in3": 7.103, "Rx_in": 5.354, "Iy_in4": 0.347, "Ry_in": 0.418, "Ixe_in4": 55.563, "Sxe_in3": 6.173, "Mal_inkip": 121.97, "Mad_inkip": 110.13, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 6.835, "Cw_in6": 19.807, "Xo_in": -0.577, "m_in": 0.401, "Ro_in": 5.401, "beta_in": 0.989, "Lu_ft": 34.4},
    "1600S162-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 1.983, "weight_lbft": 6.75, "Ix_in4": 56.824, "Sx_in3": 7.103, "Rx_in": 5.354, "Iy_in4": 0.347, "Ry_in": 0.418, "Ixe_in4": 53.725, "Sxe_in3": 5.738, "Mal_inkip": 171.79, "Mad_inkip": 142.8, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 6.835, "Cw_in6": 19.807, "Xo_in": -0.577, "m_in": 0.401, "Ro_in": 5.401, "beta_in": 0.989, "Lu_ft": 27.9},
    "1600S162-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.4, "weight_lbft": 8.17, "Ix_in4": 68.014, "Sx_in3": 8.502, "Rx_in": 5.323, "Iy_in4": 0.393, "Ry_in": 0.405, "Ixe_in4": 68.014, "Sxe_in3": 7.92, "Mal_inkip": 156.5, "Mad_inkip": 147.57, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 12.342, "Cw_in6": 23.035, "Xo_in": -0.559, "m_in": 0.391, "Ro_in": 5.368, "beta_in": 0.989, "Lu_ft": 33.7},
    "1600S162-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.4, "weight_lbft": 8.17, "Ix_in4": 68.014, "Sx_in3": 8.502, "Rx_in": 5.323, "Iy_in4": 0.393, "Ry_in": 0.405, "Ixe_in4": 66.535, "Sxe_in3": 7.399, "Mal_inkip": 221.51, "Mad_inkip": 193.72, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 12.342, "Cw_in6": 23.035, "Xo_in": -0.559, "m_in": 0.391, "Ro_in": 5.368, "beta_in": 0.989, "Lu_ft": 27.3},
    "1600S200-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.477, "weight_lbft": 5.03, "Ix_in4": 45.291, "Sx_in3": 5.661, "Rx_in": 5.537, "Iy_in4": 0.506, "Ry_in": 0.585, "Ixe_in4": 41.916, "Sxe_in3": 4.431, "Mal_inkip": 87.56, "Mad_inkip": 75.11, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.503, "Cw_in6": 27.155, "Xo_in": -0.862, "m_in": 0.584, "Ro_in": 5.634, "beta_in": 0.977, "Lu_ft": 45.7},
    "1600S200-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.477, "weight_lbft": 5.03, "Ix_in4": 45.291, "Sx_in3": 5.661, "Rx_in": 5.537, "Iy_in4": 0.506, "Ry_in": 0.585, "Ixe_in4": 40.523, "Sxe_in3": 4.045, "Mal_inkip": 121.11, "Mad_inkip": 96.27, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.503, "Cw_in6": 27.155, "Xo_in": -0.862, "m_in": 0.584, "Ro_in": 5.634, "beta_in": 0.977, "Lu_ft": 37.1},
    "1600S200-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 2.084, "weight_lbft": 7.09, "Ix_in4": 63.05, "Sx_in3": 7.881, "Rx_in": 5.5, "Iy_in4": 0.67, "Ry_in": 0.567, "Ixe_in4": 61.757, "Sxe_in3": 6.938, "Mal_inkip": 137.1, "Mad_inkip": 126.78, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 7.186, "Cw_in6": 36.744, "Xo_in": -0.835, "m_in": 0.569, "Ro_in": 5.592, "beta_in": 0.978, "Lu_ft": 44.9},
    "1600S200-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 2.084, "weight_lbft": 7.09, "Ix_in4": 63.05, "Sx_in3": 7.881, "Rx_in": 5.5, "Iy_in4": 0.67, "Ry_in": 0.567, "Ixe_in4": 59.933, "Sxe_in3": 6.5, "Mal_inkip": 194.61, "Mad_inkip": 164.99, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 7.186, "Cw_in6": 36.744, "Xo_in": -0.835, "m_in": 0.569, "Ro_in": 5.592, "beta_in": 0.978, "Lu_ft": 36.4},
    "1600S200-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.525, "weight_lbft": 8.59, "Ix_in4": 75.601, "Sx_in3": 9.45, "Rx_in": 5.472, "Iy_in4": 0.773, "Ry_in": 0.553, "Ixe_in4": 75.601, "Sxe_in3": 8.859, "Mal_inkip": 175.05, "Mad_inkip": 168.39, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 12.981, "Cw_in6": 43.132, "Xo_in": -0.815, "m_in": 0.558, "Ro_in": 5.56, "beta_in": 0.979, "Lu_ft": 44.3},
    "1600S200-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.525, "weight_lbft": 8.59, "Ix_in4": 75.601, "Sx_in3": 9.45, "Rx_in": 5.472, "Iy_in4": 0.773, "Ry_in": 0.553, "Ixe_in4": 74.084, "Sxe_in3": 8.331, "Mal_inkip": 249.44, "Mad_inkip": 221.86, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 12.981, "Cw_in6": 43.132, "Xo_in": -0.815, "m_in": 0.558, "Ro_in": 5.56, "beta_in": 0.979, "Lu_ft": 35.9},
    "1600S250-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.549, "weight_lbft": 5.27, "Ix_in4": 49.814, "Sx_in3": 6.227, "Rx_in": 5.672, "Iy_in4": 0.889, "Ry_in": 0.758, "Ixe_in4": 46.607, "Sxe_in3": 4.792, "Mal_inkip": 94.7, "Mad_inkip": 81.69, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.624, "Cw_in6": 46.23, "Xo_in": -1.167, "m_in": 0.778, "Ro_in": 5.84, "beta_in": 0.96, "Lu_ft": 57.3},
    "1600S250-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.549, "weight_lbft": 5.27, "Ix_in4": 49.814, "Sx_in3": 6.227, "Rx_in": 5.672, "Iy_in4": 0.889, "Ry_in": 0.758, "Ixe_in4": 45.55, "Sxe_in3": 4.092, "Mal_inkip": 122.51, "Mad_inkip": 104.63, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.624, "Cw_in6": 46.23, "Xo_in": -1.167, "m_in": 0.778, "Ro_in": 5.84, "beta_in": 0.96, "Lu_ft": 46.5},
    "1600S250-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 2.186, "weight_lbft": 7.44, "Ix_in4": 69.476, "Sx_in3": 8.685, "Rx_in": 5.638, "Iy_in4": 1.192, "Ry_in": 0.738, "Ixe_in4": 68.16, "Sxe_in3": 7.728, "Mal_inkip": 152.72, "Mad_inkip": 137.47, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 7.536, "Cw_in6": 63.082, "Xo_in": -1.138, "m_in": 0.762, "Ro_in": 5.799, "beta_in": 0.962, "Lu_ft": 56.5},
    "1600S250-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 2.186, "weight_lbft": 7.44, "Ix_in4": 69.476, "Sx_in3": 8.685, "Rx_in": 5.638, "Iy_in4": 1.192, "Ry_in": 0.738, "Ixe_in4": 66.577, "Sxe_in3": 6.983, "Mal_inkip": 209.06, "Mad_inkip": 178.6, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 7.536, "Cw_in6": 63.082, "Xo_in": -1.138, "m_in": 0.762, "Ro_in": 5.799, "beta_in": 0.962, "Lu_ft": 45.9},
    "1600S250-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.649, "weight_lbft": 9.01, "Ix_in4": 83.427, "Sx_in3": 10.428, "Rx_in": 5.612, "Iy_in4": 1.389, "Ry_in": 0.724, "Ixe_in4": 83.427, "Sxe_in3": 9.827, "Mal_inkip": 194.19, "Mad_inkip": 182.65, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 13.62, "Cw_in6": 74.524, "Xo_in": -1.116, "m_in": 0.75, "Ro_in": 5.768, "beta_in": 0.963, "Lu_ft": 56.0},
    "1600S250-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.649, "weight_lbft": 9.01, "Ix_in4": 83.427, "Sx_in3": 10.428, "Rx_in": 5.612, "Iy_in4": 1.389, "Ry_in": 0.724, "Ixe_in4": 81.923, "Sxe_in3": 9.222, "Mal_inkip": 276.12, "Mad_inkip": 240.07, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 13.62, "Cw_in6": 74.524, "Xo_in": -1.116, "m_in": 0.75, "Ro_in": 5.768, "beta_in": 0.963, "Lu_ft": 45.4},
    "1600S300-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.62, "weight_lbft": 5.51, "Ix_in4": 54.336, "Sx_in3": 6.792, "Rx_in": 5.792, "Iy_in4": 1.411, "Ry_in": 0.933, "Ixe_in4": 51.468, "Sxe_in3": 4.892, "Mal_inkip": 96.68, "Mad_inkip": 86.46, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.745, "Cw_in6": 71.608, "Xo_in": -1.494, "m_in": 0.981, "Ro_in": 6.054, "beta_in": 0.939, "Lu_ft": 68.7},
    "1600S300-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.62, "weight_lbft": 5.51, "Ix_in4": 54.336, "Sx_in3": 6.792, "Rx_in": 5.792, "Iy_in4": 1.411, "Ry_in": 0.933, "Ixe_in4": 49.107, "Sxe_in3": 4.21, "Mal_inkip": 126.04, "Mad_inkip": 110.54, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.745, "Cw_in6": 71.608, "Xo_in": -1.494, "m_in": 0.981, "Ro_in": 6.054, "beta_in": 0.939, "Lu_ft": 55.8},
    "1600S300-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 2.288, "weight_lbft": 7.78, "Ix_in4": 75.903, "Sx_in3": 9.488, "Rx_in": 5.76, "Iy_in4": 1.909, "Ry_in": 0.914, "Ixe_in4": 74.741, "Sxe_in3": 8.203, "Mal_inkip": 162.09, "Mad_inkip": 145.38, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 7.887, "Cw_in6": 98.275, "Xo_in": -1.463, "m_in": 0.964, "Ro_in": 6.013, "beta_in": 0.941, "Lu_ft": 68.0},
    "1600S300-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 2.288, "weight_lbft": 7.78, "Ix_in4": 75.903, "Sx_in3": 9.488, "Rx_in": 5.76, "Iy_in4": 1.909, "Ry_in": 0.914, "Ixe_in4": 72.666, "Sxe_in3": 7.391, "Mal_inkip": 221.28, "Mad_inkip": 188.32, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 7.887, "Cw_in6": 98.275, "Xo_in": -1.463, "m_in": 0.964, "Ro_in": 6.013, "beta_in": 0.941, "Lu_ft": 55.1},
    "1600S300-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.773, "weight_lbft": 9.44, "Ix_in4": 91.253, "Sx_in3": 11.407, "Rx_in": 5.737, "Iy_in4": 2.239, "Ry_in": 0.899, "Ixe_in4": 91.253, "Sxe_in3": 10.637, "Mal_inkip": 210.19, "Mad_inkip": 193.46, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 14.258, "Cw_in6": 116.606, "Xo_in": -1.439, "m_in": 0.951, "Ro_in": 5.982, "beta_in": 0.942, "Lu_ft": 67.4},
    "1600S300-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.773, "weight_lbft": 9.44, "Ix_in4": 91.253, "Sx_in3": 11.407, "Rx_in": 5.737, "Iy_in4": 2.239, "Ry_in": 0.899, "Ixe_in4": 89.913, "Sxe_in3": 9.835, "Mal_inkip": 294.48, "Mad_inkip": 253.24, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 14.258, "Cw_in6": 116.606, "Xo_in": -1.439, "m_in": 0.951, "Ro_in": 5.982, "beta_in": 0.942, "Lu_ft": 54.7},
    "1600S350-68_33ksi": {"thickness_in": 0.0713, "Fy_ksi": 33.0, "area_in2": 1.745, "weight_lbft": 5.94, "Ix_in4": 61.622, "Sx_in3": 7.703, "Rx_in": 5.943, "Iy_in4": 2.49, "Ry_in": 1.195, "Ixe_in4": 58.537, "Sxe_in3": 6.041, "Mal_inkip": 119.38, "Mad_inkip": 108.05, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.957, "Cw_in6": 127.37, "Xo_in": -2.055, "m_in": 1.322, "Ro_in": 6.401, "beta_in": 0.897, "Lu_ft": 85.8},
    "1600S350-68_50ksi": {"thickness_in": 0.0713, "Fy_ksi": 50.0, "area_in2": 1.745, "weight_lbft": 5.94, "Ix_in4": 61.622, "Sx_in3": 7.703, "Rx_in": 5.943, "Iy_in4": 2.49, "Ry_in": 1.195, "Ixe_in4": 57.437, "Sxe_in3": 5.18, "Mal_inkip": 155.08, "Mad_inkip": 138.99, "Vag_lb": 2062.0, "Vnet_lb": 2062.0, "Jx1000_in4": 2.957, "Cw_in6": 127.37, "Xo_in": -2.055, "m_in": 1.322, "Ro_in": 6.401, "beta_in": 0.897, "Lu_ft": 69.7},
    "1600S350-97_33ksi": {"thickness_in": 0.1017, "Fy_ksi": 33.0, "area_in2": 2.466, "weight_lbft": 8.39, "Ix_in4": 86.27, "Sx_in3": 10.784, "Rx_in": 5.915, "Iy_in4": 3.41, "Ry_in": 1.176, "Ixe_in4": 84.926, "Sxe_in3": 9.771, "Mal_inkip": 193.09, "Mad_inkip": 176.65, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 8.501, "Cw_in6": 175.896, "Xo_in": -2.022, "m_in": 1.304, "Ro_in": 6.361, "beta_in": 0.899, "Lu_ft": 85.2},
    "1600S350-97_50ksi": {"thickness_in": 0.1017, "Fy_ksi": 50.0, "area_in2": 2.466, "weight_lbft": 8.39, "Ix_in4": 86.27, "Sx_in3": 10.784, "Rx_in": 5.915, "Iy_in4": 3.41, "Ry_in": 1.176, "Ixe_in4": 83.691, "Sxe_in3": 8.382, "Mal_inkip": 250.96, "Mad_inkip": 230.33, "Vag_lb": 6043.0, "Vnet_lb": 6043.0, "Jx1000_in4": 8.501, "Cw_in6": 175.896, "Xo_in": -2.022, "m_in": 1.304, "Ro_in": 6.361, "beta_in": 0.899, "Lu_ft": 69.1},
    "1600S350-118_33ksi": {"thickness_in": 0.1242, "Fy_ksi": 33.0, "area_in2": 2.99, "weight_lbft": 10.18, "Ix_in4": 103.892, "Sx_in3": 12.987, "Rx_in": 5.894, "Iy_in4": 4.038, "Ry_in": 1.162, "Ixe_in4": 103.892, "Sxe_in3": 12.367, "Mal_inkip": 244.38, "Mad_inkip": 231.2, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 15.376, "Cw_in6": 209.692, "Xo_in": -1.998, "m_in": 1.291, "Ro_in": 6.331, "beta_in": 0.9, "Lu_ft": 84.8},
    "1600S350-118_50ksi": {"thickness_in": 0.1242, "Fy_ksi": 50.0, "area_in2": 2.99, "weight_lbft": 10.18, "Ix_in4": 103.892, "Sx_in3": 12.987, "Rx_in": 5.894, "Iy_in4": 4.038, "Ry_in": 1.162, "Ixe_in4": 102.53, "Sxe_in3": 11.305, "Mal_inkip": 338.47, "Mad_inkip": 304.57, "Vag_lb": 11088.0, "Vnet_lb": 11088.0, "Jx1000_in4": 15.376, "Cw_in6": 209.692, "Xo_in": -1.998, "m_in": 1.291, "Ro_in": 6.331, "beta_in": 0.9, "Lu_ft": 68.8}
  };

  // ================================================================
  // T-SECTION (TRACK) DATA  -  key: "SectionName"
  // ================================================================
  var trackData = {
    "162T125-18": {"thickness_in": 0.0188, "area_in2": 0.077, "weight_lbft": 0.26, "Ix_in4": 0.041, "Sx_in3": 0.047, "Rx_in": 0.733, "Iy_in4": 0.013, "Ry_in": 0.411, "Ixe_33_in4": 0.03, "Sxe_33_in3": 0.025, "Ma_33_inkip": 0.5, "Vag_33_lb": 302.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.009, "Cw_in6": 0.007, "Xo_in": -0.878, "m_in": 0.503, "Ro_in": 1.215, "beta_in": 0.478},
    "162T125-27": {"thickness_in": 0.0283, "area_in2": 0.117, "weight_lbft": 0.4, "Ix_in4": 0.063, "Sx_in3": 0.072, "Rx_in": 0.735, "Iy_in4": 0.02, "Ry_in": 0.41, "Ixe_33_in4": 0.05, "Sxe_33_in3": 0.044, "Ma_33_inkip": 0.87, "Vag_33_lb": 541.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.031, "Cw_in6": 0.01, "Xo_in": -0.872, "m_in": 0.501, "Ro_in": 1.211, "beta_in": 0.482},
    "162T125-30": {"thickness_in": 0.0312, "area_in2": 0.129, "weight_lbft": 0.44, "Ix_in4": 0.07, "Sx_in3": 0.079, "Rx_in": 0.735, "Iy_in4": 0.022, "Ry_in": 0.409, "Ixe_33_in4": 0.057, "Sxe_33_in3": 0.05, "Ma_33_inkip": 1.0, "Vag_33_lb": 597.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.042, "Cw_in6": 0.012, "Xo_in": -0.87, "m_in": 0.5, "Ro_in": 1.21, "beta_in": 0.483},
    "162T125-33": {"thickness_in": 0.0346, "area_in2": 0.143, "weight_lbft": 0.49, "Ix_in4": 0.077, "Sx_in3": 0.087, "Rx_in": 0.736, "Iy_in4": 0.024, "Ry_in": 0.408, "Ixe_33_in4": 0.066, "Sxe_33_in3": 0.058, "Ma_33_inkip": 1.15, "Vag_33_lb": 663.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.057, "Cw_in6": 0.013, "Xo_in": -0.868, "m_in": 0.499, "Ro_in": 1.209, "beta_in": 0.484},
    "250T125-18": {"thickness_in": 0.0188, "area_in2": 0.094, "weight_lbft": 0.32, "Ix_in4": 0.103, "Sx_in3": 0.079, "Rx_in": 1.051, "Iy_in4": 0.015, "Ry_in": 0.4, "Ixe_33_in4": 0.078, "Sxe_33_in3": 0.045, "Ma_33_inkip": 0.9, "Vag_33_lb": 249.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.011, "Cw_in6": 0.018, "Xo_in": -0.769, "m_in": 0.46, "Ro_in": 1.362, "beta_in": 0.681},
    "250T125-27": {"thickness_in": 0.0283, "area_in2": 0.141, "weight_lbft": 0.48, "Ix_in4": 0.157, "Sx_in3": 0.119, "Rx_in": 1.053, "Iy_in4": 0.022, "Ry_in": 0.398, "Ixe_33_in4": 0.129, "Sxe_33_in3": 0.079, "Ma_33_inkip": 1.56, "Vag_33_lb": 685.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.038, "Cw_in6": 0.027, "Xo_in": -0.763, "m_in": 0.457, "Ro_in": 1.36, "beta_in": 0.685},
    "250T125-30": {"thickness_in": 0.0312, "area_in2": 0.156, "weight_lbft": 0.53, "Ix_in4": 0.173, "Sx_in3": 0.131, "Rx_in": 1.053, "Iy_in4": 0.025, "Ry_in": 0.397, "Ixe_33_in4": 0.145, "Sxe_33_in3": 0.09, "Ma_33_inkip": 1.77, "Vag_33_lb": 832.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.051, "Cw_in6": 0.03, "Xo_in": -0.762, "m_in": 0.456, "Ro_in": 1.359, "beta_in": 0.686},
    "250T125-33": {"thickness_in": 0.0346, "area_in2": 0.173, "weight_lbft": 0.59, "Ix_in4": 0.192, "Sx_in3": 0.145, "Rx_in": 1.054, "Iy_in4": 0.027, "Ry_in": 0.397, "Ixe_33_in4": 0.166, "Sxe_33_in3": 0.103, "Ma_33_inkip": 2.03, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.069, "Cw_in6": 0.033, "Xo_in": -0.76, "m_in": 0.456, "Ro_in": 1.358, "beta_in": 0.687},
    "250T125-43": {"thickness_in": 0.0451, "area_in2": 0.225, "weight_lbft": 0.77, "Ix_in4": 0.25, "Sx_in3": 0.188, "Rx_in": 1.055, "Iy_in4": 0.035, "Ry_in": 0.395, "Ixe_33_in4": 0.231, "Sxe_33_in3": 0.147, "Ma_33_inkip": 2.91, "Vag_33_lb": 1356.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.153, "Cw_in6": 0.042, "Xo_in": -0.755, "m_in": 0.453, "Ro_in": 1.356, "beta_in": 0.69},
    "250T125-54": {"thickness_in": 0.0566, "area_in2": 0.282, "weight_lbft": 0.96, "Ix_in4": 0.318, "Sx_in3": 0.236, "Rx_in": 1.062, "Iy_in4": 0.043, "Ry_in": 0.392, "Ixe_33_in4": 0.31, "Sxe_33_in3": 0.203, "Ma_33_inkip": 4.01, "Vag_33_lb": 1692.0, "Ixe_50_in4": 0.297, "Sxe_50_in3": 0.188, "Ma_50_inkip": 5.64, "Vag_50_lb": 2563.0, "Jx1000_in4": 0.301, "Cw_in6": 0.054, "Xo_in": -0.749, "m_in": 0.449, "Ro_in": 1.357, "beta_in": 0.696},
    "250T125-68": {"thickness_in": 0.0713, "area_in2": 0.355, "weight_lbft": 1.21, "Ix_in4": 0.408, "Sx_in3": 0.297, "Rx_in": 1.072, "Iy_in4": 0.054, "Ry_in": 0.389, "Ixe_33_in4": 0.408, "Sxe_33_in3": 0.281, "Ma_33_inkip": 5.56, "Vag_33_lb": 2111.0, "Ixe_50_in4": 0.402, "Sxe_50_in3": 0.262, "Ma_50_inkip": 7.85, "Vag_50_lb": 3199.0, "Jx1000_in4": 0.602, "Cw_in6": 0.069, "Xo_in": -0.74, "m_in": 0.444, "Ro_in": 1.36, "beta_in": 0.704},
    "250T125-97": {"thickness_in": 0.1017, "area_in2": 0.506, "weight_lbft": 1.72, "Ix_in4": 0.604, "Sx_in3": 0.423, "Rx_in": 1.092, "Iy_in4": 0.074, "Ry_in": 0.383, "Ixe_33_in4": 0.604, "Sxe_33_in3": 0.423, "Ma_33_inkip": 9.56, "Vag_33_lb": 2954.0, "Ixe_50_in4": 0.604, "Sxe_50_in3": 0.423, "Ma_50_inkip": 12.67, "Vag_50_lb": 4476.0, "Jx1000_in4": 1.745, "Cw_in6": 0.101, "Xo_in": -0.724, "m_in": 0.434, "Ro_in": 1.365, "beta_in": 0.719},
    "250T150-27": {"thickness_in": 0.0283, "area_in2": 0.156, "weight_lbft": 0.53, "Ix_in4": 0.181, "Sx_in3": 0.137, "Rx_in": 1.078, "Iy_in4": 0.037, "Ry_in": 0.486, "Ixe_33_in4": 0.139, "Sxe_33_in3": 0.082, "Ma_33_inkip": 1.61, "Vag_33_lb": 685.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.042, "Cw_in6": 0.044, "Xo_in": -0.976, "m_in": 0.575, "Ro_in": 1.534, "beta_in": 0.595},
    "250T150-30": {"thickness_in": 0.0312, "area_in2": 0.172, "weight_lbft": 0.58, "Ix_in4": 0.199, "Sx_in3": 0.151, "Rx_in": 1.078, "Iy_in4": 0.04, "Ry_in": 0.486, "Ixe_33_in4": 0.157, "Sxe_33_in3": 0.093, "Ma_33_inkip": 1.83, "Vag_33_lb": 832.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.056, "Cw_in6": 0.049, "Xo_in": -0.975, "m_in": 0.574, "Ro_in": 1.533, "beta_in": 0.595},
    "250T150-33": {"thickness_in": 0.0346, "area_in2": 0.19, "weight_lbft": 0.65, "Ix_in4": 0.221, "Sx_in3": 0.167, "Rx_in": 1.079, "Iy_in4": 0.045, "Ry_in": 0.485, "Ixe_33_in4": 0.179, "Sxe_33_in3": 0.107, "Ma_33_inkip": 2.11, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.076, "Cw_in6": 0.054, "Xo_in": -0.973, "m_in": 0.573, "Ro_in": 1.532, "beta_in": 0.596},
    "250T150-43": {"thickness_in": 0.0451, "area_in2": 0.248, "weight_lbft": 0.84, "Ix_in4": 0.289, "Sx_in3": 0.217, "Rx_in": 1.08, "Iy_in4": 0.058, "Ry_in": 0.483, "Ixe_33_in4": 0.252, "Sxe_33_in3": 0.154, "Ma_33_inkip": 3.03, "Vag_33_lb": 1356.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.168, "Cw_in6": 0.07, "Xo_in": -0.968, "m_in": 0.57, "Ro_in": 1.529, "beta_in": 0.599},
    "250T150-54": {"thickness_in": 0.0566, "area_in2": 0.311, "weight_lbft": 1.06, "Ix_in4": 0.368, "Sx_in3": 0.273, "Rx_in": 1.088, "Iy_in4": 0.072, "Ry_in": 0.481, "Ixe_33_in4": 0.342, "Sxe_33_in3": 0.213, "Ma_33_inkip": 4.22, "Vag_33_lb": 1692.0, "Ixe_50_in4": 0.325, "Sxe_50_in3": 0.197, "Ma_50_inkip": 5.89, "Vag_50_lb": 2563.0, "Jx1000_in4": 0.332, "Cw_in6": 0.089, "Xo_in": -0.961, "m_in": 0.566, "Ro_in": 1.529, "beta_in": 0.605},
    "250T150-68": {"thickness_in": 0.0713, "area_in2": 0.391, "weight_lbft": 1.33, "Ix_in4": 0.472, "Sx_in3": 0.344, "Rx_in": 1.099, "Iy_in4": 0.089, "Ry_in": 0.478, "Ixe_33_in4": 0.465, "Sxe_33_in3": 0.299, "Ma_33_inkip": 5.92, "Vag_33_lb": 2111.0, "Ixe_50_in4": 0.445, "Sxe_50_in3": 0.276, "Ma_50_inkip": 8.27, "Vag_50_lb": 3199.0, "Jx1000_in4": 0.663, "Cw_in6": 0.114, "Xo_in": -0.953, "m_in": 0.561, "Ro_in": 1.531, "beta_in": 0.613},
    "250T150-97": {"thickness_in": 0.1017, "area_in2": 0.557, "weight_lbft": 1.9, "Ix_in4": 0.701, "Sx_in3": 0.491, "Rx_in": 1.121, "Iy_in4": 0.124, "Ry_in": 0.471, "Ixe_33_in4": 0.701, "Sxe_33_in3": 0.491, "Ma_33_inkip": 9.69, "Vag_33_lb": 2954.0, "Ixe_50_in4": 0.701, "Sxe_50_in3": 0.463, "Ma_50_inkip": 13.86, "Vag_50_lb": 4476.0, "Jx1000_in4": 1.921, "Cw_in6": 0.168, "Xo_in": -0.935, "m_in": 0.55, "Ro_in": 1.534, "beta_in": 0.629},
    "250T200-33": {"thickness_in": 0.0346, "area_in2": 0.225, "weight_lbft": 0.76, "Ix_in4": 0.28, "Sx_in3": 0.212, "Rx_in": 1.117, "Iy_in4": 0.097, "Ry_in": 0.658, "Ixe_33_in4": 0.203, "Sxe_33_in3": 0.112, "Ma_33_inkip": 2.22, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.09, "Cw_in6": 0.118, "Xo_in": -1.418, "m_in": 0.813, "Ro_in": 1.921, "beta_in": 0.455},
    "250T200-43": {"thickness_in": 0.0451, "area_in2": 0.293, "weight_lbft": 1.0, "Ix_in4": 0.366, "Sx_in3": 0.275, "Rx_in": 1.118, "Iy_in4": 0.126, "Ry_in": 0.657, "Ixe_33_in4": 0.288, "Sxe_33_in3": 0.163, "Ma_33_inkip": 3.21, "Vag_33_lb": 1356.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.198, "Cw_in6": 0.153, "Xo_in": -1.413, "m_in": 0.81, "Ro_in": 1.918, "beta_in": 0.457},
    "250T200-54": {"thickness_in": 0.0566, "area_in2": 0.367, "weight_lbft": 1.25, "Ix_in4": 0.466, "Sx_in3": 0.346, "Rx_in": 1.127, "Iy_in4": 0.157, "Ry_in": 0.654, "Ixe_33_in4": 0.396, "Sxe_33_in3": 0.228, "Ma_33_inkip": 4.51, "Vag_33_lb": 1692.0, "Ixe_50_in4": 0.371, "Sxe_50_in3": 0.209, "Ma_50_inkip": 6.25, "Vag_50_lb": 2563.0, "Jx1000_in4": 0.392, "Cw_in6": 0.195, "Xo_in": -1.405, "m_in": 0.806, "Ro_in": 1.917, "beta_in": 0.462},
    "250T200-68": {"thickness_in": 0.0713, "area_in2": 0.462, "weight_lbft": 1.57, "Ix_in4": 0.6, "Sx_in3": 0.437, "Rx_in": 1.139, "Iy_in4": 0.196, "Ry_in": 0.652, "Ixe_33_in4": 0.548, "Sxe_33_in3": 0.324, "Ma_33_inkip": 6.41, "Vag_33_lb": 2111.0, "Ixe_50_in4": 0.517, "Sxe_50_in3": 0.296, "Ma_50_inkip": 8.86, "Vag_50_lb": 3199.0, "Jx1000_in4": 0.783, "Cw_in6": 0.251, "Xo_in": -1.396, "m_in": 0.8, "Ro_in": 1.916, "beta_in": 0.469},
    "250T200-97": {"thickness_in": 0.1017, "area_in2": 0.659, "weight_lbft": 2.24, "Ix_in4": 0.893, "Sx_in3": 0.626, "Rx_in": 1.165, "Iy_in4": 0.275, "Ry_in": 0.646, "Ixe_33_in4": 0.893, "Sxe_33_in3": 0.556, "Ma_33_inkip": 10.99, "Vag_33_lb": 2954.0, "Ixe_50_in4": 0.856, "Sxe_50_in3": 0.51, "Ma_50_inkip": 15.27, "Vag_50_lb": 4476.0, "Jx1000_in4": 2.271, "Cw_in6": 0.374, "Xo_in": -1.376, "m_in": 0.789, "Ro_in": 1.915, "beta_in": 0.484},
    "350T125-18": {"thickness_in": 0.0188, "area_in2": 0.113, "weight_lbft": 0.38, "Ix_in4": 0.219, "Sx_in3": 0.121, "Rx_in": 1.394, "Iy_in4": 0.016, "Ry_in": 0.383, "Ixe_33_in4": 0.174, "Sxe_33_in3": 0.063, "Ma_33_inkip": 1.25, "Vag_33_lb": 175.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.013, "Cw_in6": 0.038, "Xo_in": -0.675, "m_in": 0.418, "Ro_in": 1.595, "beta_in": 0.821},
    "350T125-27": {"thickness_in": 0.0283, "area_in2": 0.17, "weight_lbft": 0.58, "Ix_in4": 0.331, "Sx_in3": 0.182, "Rx_in": 1.396, "Iy_in4": 0.025, "Ry_in": 0.381, "Ixe_33_in4": 0.277, "Sxe_33_in3": 0.128, "Ma_33_inkip": 2.53, "Vag_33_lb": 590.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.045, "Cw_in6": 0.057, "Xo_in": -0.67, "m_in": 0.416, "Ro_in": 1.595, "beta_in": 0.823},
    "350T125-30": {"thickness_in": 0.0312, "area_in2": 0.187, "weight_lbft": 0.64, "Ix_in4": 0.365, "Sx_in3": 0.2, "Rx_in": 1.396, "Iy_in4": 0.027, "Ry_in": 0.38, "Ixe_33_in4": 0.312, "Sxe_33_in3": 0.145, "Ma_33_inkip": 2.86, "Vag_33_lb": 790.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.061, "Cw_in6": 0.063, "Xo_in": -0.669, "m_in": 0.415, "Ro_in": 1.594, "beta_in": 0.824},
    "350T125-33": {"thickness_in": 0.0346, "area_in2": 0.207, "weight_lbft": 0.71, "Ix_in4": 0.405, "Sx_in3": 0.222, "Rx_in": 1.397, "Iy_in4": 0.03, "Ry_in": 0.379, "Ixe_33_in4": 0.354, "Sxe_33_in3": 0.165, "Ma_33_inkip": 3.27, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.083, "Cw_in6": 0.07, "Xo_in": -0.668, "m_in": 0.414, "Ro_in": 1.594, "beta_in": 0.824},
    "350T125-43": {"thickness_in": 0.0451, "area_in2": 0.27, "weight_lbft": 0.92, "Ix_in4": 0.528, "Sx_in3": 0.288, "Rx_in": 1.397, "Iy_in4": 0.038, "Ry_in": 0.377, "Ixe_33_in4": 0.49, "Sxe_33_in3": 0.233, "Ma_33_inkip": 4.61, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.183, "Cw_in6": 0.09, "Xo_in": -0.663, "m_in": 0.412, "Ro_in": 1.592, "beta_in": 0.826},
    "350T125-54": {"thickness_in": 0.0566, "area_in2": 0.339, "weight_lbft": 1.15, "Ix_in4": 0.668, "Sx_in3": 0.361, "Rx_in": 1.404, "Iy_in4": 0.048, "Ry_in": 0.375, "Ixe_33_in4": 0.651, "Sxe_33_in3": 0.317, "Ma_33_inkip": 6.26, "Vag_33_lb": 2392.0, "Ixe_50_in4": 0.626, "Sxe_50_in3": 0.297, "Ma_50_inkip": 8.89, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.362, "Cw_in6": 0.114, "Xo_in": -0.658, "m_in": 0.408, "Ro_in": 1.595, "beta_in": 0.83},
    "350T125-68": {"thickness_in": 0.0713, "area_in2": 0.427, "weight_lbft": 1.45, "Ix_in4": 0.851, "Sx_in3": 0.454, "Rx_in": 1.412, "Iy_in4": 0.059, "Ry_in": 0.372, "Ixe_33_in4": 0.851, "Sxe_33_in3": 0.433, "Ma_33_inkip": 8.55, "Vag_33_lb": 2994.0, "Ixe_50_in4": 0.839, "Sxe_50_in3": 0.407, "Ma_50_inkip": 12.18, "Vag_50_lb": 4536.0, "Jx1000_in4": 0.723, "Cw_in6": 0.144, "Xo_in": -0.65, "m_in": 0.403, "Ro_in": 1.599, "beta_in": 0.835},
    "350T125-97": {"thickness_in": 0.1017, "area_in2": 0.608, "weight_lbft": 2.07, "Ix_in4": 1.243, "Sx_in3": 0.645, "Rx_in": 1.43, "Iy_in4": 0.081, "Ry_in": 0.366, "Ixe_33_in4": 1.243, "Sxe_33_in3": 0.645, "Ma_33_inkip": 14.56, "Vag_33_lb": 4213.0, "Ixe_50_in4": 1.243, "Sxe_50_in3": 0.645, "Ma_50_inkip": 19.3, "Vag_50_lb": 6383.0, "Jx1000_in4": 2.096, "Cw_in6": 0.209, "Xo_in": -0.636, "m_in": 0.394, "Ro_in": 1.607, "beta_in": 0.844},
    "350T150-27": {"thickness_in": 0.0283, "area_in2": 0.184, "weight_lbft": 0.63, "Ix_in4": 0.377, "Sx_in3": 0.207, "Rx_in": 1.431, "Iy_in4": 0.041, "Ry_in": 0.47, "Ixe_33_in4": 0.298, "Sxe_33_in3": 0.132, "Ma_33_inkip": 2.62, "Vag_33_lb": 590.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.049, "Cw_in6": 0.094, "Xo_in": -0.869, "m_in": 0.529, "Ro_in": 1.739, "beta_in": 0.75},
    "350T150-30": {"thickness_in": 0.0312, "area_in2": 0.203, "weight_lbft": 0.69, "Ix_in4": 0.416, "Sx_in3": 0.228, "Rx_in": 1.432, "Iy_in4": 0.045, "Ry_in": 0.469, "Ixe_33_in4": 0.336, "Sxe_33_in3": 0.15, "Ma_33_inkip": 2.96, "Vag_33_lb": 790.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.066, "Cw_in6": 0.103, "Xo_in": -0.867, "m_in": 0.528, "Ro_in": 1.739, "beta_in": 0.751},
    "350T150-33": {"thickness_in": 0.0346, "area_in2": 0.225, "weight_lbft": 0.76, "Ix_in4": 0.461, "Sx_in3": 0.253, "Rx_in": 1.432, "Iy_in4": 0.049, "Ry_in": 0.469, "Ixe_33_in4": 0.382, "Sxe_33_in3": 0.171, "Ma_33_inkip": 3.39, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.09, "Cw_in6": 0.114, "Xo_in": -0.866, "m_in": 0.527, "Ro_in": 1.738, "beta_in": 0.752},
    "350T150-43": {"thickness_in": 0.0451, "area_in2": 0.293, "weight_lbft": 1.0, "Ix_in4": 0.601, "Sx_in3": 0.328, "Rx_in": 1.433, "Iy_in4": 0.064, "Ry_in": 0.467, "Ixe_33_in4": 0.531, "Sxe_33_in3": 0.243, "Ma_33_inkip": 4.8, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.198, "Cw_in6": 0.148, "Xo_in": -0.861, "m_in": 0.525, "Ro_in": 1.736, "beta_in": 0.754},
    "350T150-54": {"thickness_in": 0.0566, "area_in2": 0.367, "weight_lbft": 1.25, "Ix_in4": 0.761, "Sx_in3": 0.412, "Rx_in": 1.44, "Iy_in4": 0.079, "Ry_in": 0.465, "Ixe_33_in4": 0.712, "Sxe_33_in3": 0.332, "Ma_33_inkip": 6.57, "Vag_33_lb": 2392.0, "Ixe_50_in4": 0.679, "Sxe_50_in3": 0.31, "Ma_50_inkip": 9.28, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.392, "Cw_in6": 0.187, "Xo_in": -0.855, "m_in": 0.521, "Ro_in": 1.738, "beta_in": 0.758},
    "350T150-68": {"thickness_in": 0.0713, "area_in2": 0.462, "weight_lbft": 1.57, "Ix_in4": 0.972, "Sx_in3": 0.518, "Rx_in": 1.45, "Iy_in4": 0.099, "Ry_in": 0.462, "Ixe_33_in4": 0.957, "Sxe_33_in3": 0.459, "Ma_33_inkip": 9.07, "Vag_33_lb": 2994.0, "Ixe_50_in4": 0.919, "Sxe_50_in3": 0.428, "Ma_50_inkip": 12.81, "Vag_50_lb": 4536.0, "Jx1000_in4": 0.783, "Cw_in6": 0.238, "Xo_in": -0.847, "m_in": 0.516, "Ro_in": 1.741, "beta_in": 0.763},
    "350T150-97": {"thickness_in": 0.1017, "area_in2": 0.659, "weight_lbft": 2.24, "Ix_in4": 1.422, "Sx_in3": 0.738, "Rx_in": 1.469, "Iy_in4": 0.136, "Ry_in": 0.455, "Ixe_33_in4": 1.422, "Sxe_33_in3": 0.738, "Ma_33_inkip": 14.58, "Vag_33_lb": 4213.0, "Ixe_50_in4": 1.422, "Sxe_50_in3": 0.701, "Ma_50_inkip": 20.98, "Vag_50_lb": 6383.0, "Jx1000_in4": 2.271, "Cw_in6": 0.346, "Xo_in": -0.831, "m_in": 0.506, "Ro_in": 1.748, "beta_in": 0.774},
    "350T200-33": {"thickness_in": 0.0346, "area_in2": 0.259, "weight_lbft": 0.88, "Ix_in4": 0.574, "Sx_in3": 0.315, "Rx_in": 1.487, "Iy_in4": 0.108, "Ry_in": 0.647, "Ixe_33_in4": 0.428, "Sxe_33_in3": 0.181, "Ma_33_inkip": 3.57, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.103, "Cw_in6": 0.249, "Xo_in": -1.285, "m_in": 0.761, "Ro_in": 2.069, "beta_in": 0.614},
    "350T200-43": {"thickness_in": 0.0451, "area_in2": 0.338, "weight_lbft": 1.15, "Ix_in4": 0.749, "Sx_in3": 0.409, "Rx_in": 1.489, "Iy_in4": 0.14, "Ry_in": 0.645, "Ixe_33_in4": 0.6, "Sxe_33_in3": 0.257, "Ma_33_inkip": 5.09, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.229, "Cw_in6": 0.323, "Xo_in": -1.28, "m_in": 0.758, "Ro_in": 2.066, "beta_in": 0.616},
    "350T200-54": {"thickness_in": 0.0566, "area_in2": 0.424, "weight_lbft": 1.44, "Ix_in4": 0.949, "Sx_in3": 0.513, "Rx_in": 1.496, "Iy_in4": 0.175, "Ry_in": 0.642, "Ixe_33_in4": 0.814, "Sxe_33_in3": 0.355, "Ma_33_inkip": 7.01, "Vag_33_lb": 2392.0, "Ixe_50_in4": 0.77, "Sxe_50_in3": 0.329, "Ma_50_inkip": 9.85, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.453, "Cw_in6": 0.409, "Xo_in": -1.273, "m_in": 0.754, "Ro_in": 2.067, "beta_in": 0.621},
    "350T200-68": {"thickness_in": 0.0713, "area_in2": 0.534, "weight_lbft": 1.82, "Ix_in4": 1.213, "Sx_in3": 0.647, "Rx_in": 1.508, "Iy_in4": 0.218, "Ry_in": 0.639, "Ixe_33_in4": 1.112, "Sxe_33_in3": 0.496, "Ma_33_inkip": 9.8, "Vag_33_lb": 2994.0, "Ixe_50_in4": 1.054, "Sxe_50_in3": 0.458, "Ma_50_inkip": 13.71, "Vag_50_lb": 4536.0, "Jx1000_in4": 0.904, "Cw_in6": 0.522, "Xo_in": -1.264, "m_in": 0.749, "Ro_in": 2.069, "beta_in": 0.626},
    "350T200-97": {"thickness_in": 0.1017, "area_in2": 0.761, "weight_lbft": 2.59, "Ix_in4": 1.78, "Sx_in3": 0.923, "Rx_in": 1.53, "Iy_in4": 0.305, "Ry_in": 0.633, "Ixe_33_in4": 1.779, "Sxe_33_in3": 0.831, "Ma_33_inkip": 16.41, "Vag_33_lb": 4213.0, "Ixe_50_in4": 1.708, "Sxe_50_in3": 0.769, "Ma_50_inkip": 23.01, "Vag_50_lb": 6383.0, "Jx1000_in4": 2.622, "Cw_in6": 0.765, "Xo_in": -1.247, "m_in": 0.738, "Ro_in": 2.073, "beta_in": 0.638},
    "350T250-54": {"thickness_in": 0.0566, "area_in2": 0.48, "weight_lbft": 1.63, "Ix_in4": 1.137, "Sx_in3": 0.615, "Rx_in": 1.538, "Iy_in4": 0.321, "Ry_in": 0.817, "Ixe_33_in4": 0.9, "Sxe_33_in3": 0.371, "Ma_33_inkip": 7.33, "Vag_33_lb": 2392.0, "Ixe_50_in4": 0.846, "Sxe_50_in3": 0.343, "Ma_50_inkip": 10.26, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.513, "Cw_in6": 0.752, "Xo_in": -1.712, "m_in": 0.992, "Ro_in": 2.442, "beta_in": 0.509},
    "350T250-68": {"thickness_in": 0.0713, "area_in2": 0.605, "weight_lbft": 2.06, "Ix_in4": 1.454, "Sx_in3": 0.776, "Rx_in": 1.55, "Iy_in4": 0.401, "Ry_in": 0.814, "Ixe_33_in4": 1.241, "Sxe_33_in3": 0.522, "Ma_33_inkip": 10.31, "Vag_33_lb": 2994.0, "Ixe_50_in4": 1.168, "Sxe_50_in3": 0.479, "Ma_50_inkip": 14.35, "Vag_50_lb": 4536.0, "Jx1000_in4": 1.025, "Cw_in6": 0.961, "Xo_in": -1.703, "m_in": 0.987, "Ro_in": 2.443, "beta_in": 0.514},
    "350T250-97": {"thickness_in": 0.1017, "area_in2": 0.862, "weight_lbft": 2.93, "Ix_in4": 2.139, "Sx_in3": 1.109, "Rx_in": 1.575, "Iy_in4": 0.563, "Ry_in": 0.808, "Ixe_33_in4": 2.027, "Sxe_33_in3": 0.889, "Ma_33_inkip": 17.56, "Vag_33_lb": 4213.0, "Ixe_50_in4": 1.924, "Sxe_50_in3": 0.815, "Ma_50_inkip": 24.39, "Vag_50_lb": 6383.0, "Jx1000_in4": 2.973, "Cw_in6": 1.413, "Xo_in": -1.684, "m_in": 0.975, "Ro_in": 2.443, "beta_in": 0.525},
    "362T125-18": {"thickness_in": 0.0188, "area_in2": 0.115, "weight_lbft": 0.39, "Ix_in4": 0.237, "Sx_in3": 0.126, "Rx_in": 1.435, "Iy_in4": 0.017, "Ry_in": 0.38, "Ixe_33_in4": 0.189, "Sxe_33_in3": 0.065, "Ma_33_inkip": 1.29, "Vag_33_lb": 169.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.014, "Cw_in6": 0.042, "Xo_in": -0.665, "m_in": 0.413, "Ro_in": 1.627, "beta_in": 0.833},
    "362T125-27": {"thickness_in": 0.0283, "area_in2": 0.173, "weight_lbft": 0.59, "Ix_in4": 0.358, "Sx_in3": 0.191, "Rx_in": 1.438, "Iy_in4": 0.025, "Ry_in": 0.378, "Ixe_33_in4": 0.301, "Sxe_33_in3": 0.135, "Ma_33_inkip": 2.66, "Vag_33_lb": 569.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.046, "Cw_in6": 0.062, "Xo_in": -0.661, "m_in": 0.411, "Ro_in": 1.627, "beta_in": 0.835},
    "362T125-30": {"thickness_in": 0.0312, "area_in2": 0.191, "weight_lbft": 0.65, "Ix_in4": 0.395, "Sx_in3": 0.21, "Rx_in": 1.438, "Iy_in4": 0.027, "Ry_in": 0.378, "Ixe_33_in4": 0.339, "Sxe_33_in3": 0.152, "Ma_33_inkip": 3.01, "Vag_33_lb": 762.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.062, "Cw_in6": 0.068, "Xo_in": -0.659, "m_in": 0.41, "Ro_in": 1.626, "beta_in": 0.836},
    "362T125-33": {"thickness_in": 0.0346, "area_in2": 0.212, "weight_lbft": 0.72, "Ix_in4": 0.438, "Sx_in3": 0.232, "Rx_in": 1.438, "Iy_in4": 0.03, "Ry_in": 0.377, "Ixe_33_in4": 0.384, "Sxe_33_in3": 0.174, "Ma_33_inkip": 3.44, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.085, "Cw_in6": 0.076, "Xo_in": -0.658, "m_in": 0.409, "Ro_in": 1.626, "beta_in": 0.836},
    "362T125-43": {"thickness_in": 0.0451, "area_in2": 0.276, "weight_lbft": 0.94, "Ix_in4": 0.571, "Sx_in3": 0.302, "Rx_in": 1.439, "Iy_in4": 0.039, "Ry_in": 0.375, "Ixe_33_in4": 0.531, "Sxe_33_in3": 0.245, "Ma_33_inkip": 4.84, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.187, "Cw_in6": 0.098, "Xo_in": -0.654, "m_in": 0.407, "Ro_in": 1.625, "beta_in": 0.838},
    "362T125-54": {"thickness_in": 0.0566, "area_in2": 0.346, "weight_lbft": 1.18, "Ix_in4": 0.723, "Sx_in3": 0.378, "Rx_in": 1.445, "Iy_in4": 0.048, "Ry_in": 0.373, "Ixe_33_in4": 0.705, "Sxe_33_in3": 0.332, "Ma_33_inkip": 6.57, "Vag_33_lb": 2480.0, "Ixe_50_in4": 0.678, "Sxe_50_in3": 0.312, "Ma_50_inkip": 9.34, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.369, "Cw_in6": 0.123, "Xo_in": -0.648, "m_in": 0.404, "Ro_in": 1.627, "beta_in": 0.841},
    "362T125-68": {"thickness_in": 0.0713, "area_in2": 0.436, "weight_lbft": 1.48, "Ix_in4": 0.921, "Sx_in3": 0.475, "Rx_in": 1.454, "Iy_in4": 0.06, "Ry_in": 0.37, "Ixe_33_in4": 0.921, "Sxe_33_in3": 0.453, "Ma_33_inkip": 8.95, "Vag_33_lb": 3104.0, "Ixe_50_in4": 0.907, "Sxe_50_in3": 0.427, "Ma_50_inkip": 12.78, "Vag_50_lb": 4703.0, "Jx1000_in4": 0.738, "Cw_in6": 0.156, "Xo_in": -0.641, "m_in": 0.399, "Ro_in": 1.631, "beta_in": 0.846},
    "362T125-97": {"thickness_in": 0.1017, "area_in2": 0.621, "weight_lbft": 2.11, "Ix_in4": 1.343, "Sx_in3": 0.675, "Rx_in": 1.471, "Iy_in4": 0.082, "Ry_in": 0.363, "Ixe_33_in4": 1.343, "Sxe_33_in3": 0.675, "Ma_33_inkip": 15.24, "Vag_33_lb": 4370.0, "Ixe_50_in4": 1.343, "Sxe_50_in3": 0.675, "Ma_50_inkip": 20.2, "Vag_50_lb": 6622.0, "Jx1000_in4": 2.14, "Cw_in6": 0.226, "Xo_in": -0.626, "m_in": 0.39, "Ro_in": 1.639, "beta_in": 0.854},
    "362T150-27": {"thickness_in": 0.0283, "area_in2": 0.187, "weight_lbft": 0.64, "Ix_in4": 0.408, "Sx_in3": 0.217, "Rx_in": 1.475, "Iy_in4": 0.041, "Ry_in": 0.468, "Ixe_33_in4": 0.323, "Sxe_33_in3": 0.14, "Ma_33_inkip": 2.76, "Vag_33_lb": 569.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.05, "Cw_in6": 0.102, "Xo_in": -0.857, "m_in": 0.524, "Ro_in": 1.769, "beta_in": 0.765},
    "362T150-30": {"thickness_in": 0.0312, "area_in2": 0.207, "weight_lbft": 0.7, "Ix_in4": 0.449, "Sx_in3": 0.239, "Rx_in": 1.475, "Iy_in4": 0.045, "Ry_in": 0.467, "Ixe_33_in4": 0.364, "Sxe_33_in3": 0.158, "Ma_33_inkip": 3.12, "Vag_33_lb": 762.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.067, "Cw_in6": 0.112, "Xo_in": -0.856, "m_in": 0.523, "Ro_in": 1.768, "beta_in": 0.766},
    "362T150-33": {"thickness_in": 0.0346, "area_in2": 0.229, "weight_lbft": 0.78, "Ix_in4": 0.499, "Sx_in3": 0.264, "Rx_in": 1.475, "Iy_in4": 0.05, "Ry_in": 0.467, "Ixe_33_in4": 0.414, "Sxe_33_in3": 0.18, "Ma_33_inkip": 3.56, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.091, "Cw_in6": 0.124, "Xo_in": -0.854, "m_in": 0.522, "Ro_in": 1.767, "beta_in": 0.766},
    "362T150-43": {"thickness_in": 0.0451, "area_in2": 0.298, "weight_lbft": 1.02, "Ix_in4": 0.65, "Sx_in3": 0.343, "Rx_in": 1.476, "Iy_in4": 0.064, "Ry_in": 0.465, "Ixe_33_in4": 0.574, "Sxe_33_in3": 0.255, "Ma_33_inkip": 5.04, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.202, "Cw_in6": 0.16, "Xo_in": -0.85, "m_in": 0.519, "Ro_in": 1.766, "beta_in": 0.768},
    "362T150-54": {"thickness_in": 0.0566, "area_in2": 0.374, "weight_lbft": 1.27, "Ix_in4": 0.823, "Sx_in3": 0.431, "Rx_in": 1.483, "Iy_in4": 0.08, "Ry_in": 0.462, "Ixe_33_in4": 0.769, "Sxe_33_in3": 0.349, "Ma_33_inkip": 6.89, "Vag_33_lb": 2480.0, "Ixe_50_in4": 0.735, "Sxe_50_in3": 0.325, "Ma_50_inkip": 9.74, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.4, "Cw_in6": 0.202, "Xo_in": -0.844, "m_in": 0.516, "Ro_in": 1.768, "beta_in": 0.772},
    "362T150-68": {"thickness_in": 0.0713, "area_in2": 0.471, "weight_lbft": 1.6, "Ix_in4": 1.05, "Sx_in3": 0.542, "Rx_in": 1.492, "Iy_in4": 0.099, "Ry_in": 0.459, "Ixe_33_in4": 1.034, "Sxe_33_in3": 0.48, "Ma_33_inkip": 9.49, "Vag_33_lb": 3104.0, "Ixe_50_in4": 0.993, "Sxe_50_in3": 0.449, "Ma_50_inkip": 13.43, "Vag_50_lb": 4703.0, "Jx1000_in4": 0.799, "Cw_in6": 0.257, "Xo_in": -0.836, "m_in": 0.511, "Ro_in": 1.771, "beta_in": 0.777},
    "362T150-97": {"thickness_in": 0.1017, "area_in2": 0.672, "weight_lbft": 2.29, "Ix_in4": 1.534, "Sx_in3": 0.771, "Rx_in": 1.512, "Iy_in4": 0.138, "Ry_in": 0.453, "Ixe_33_in4": 1.534, "Sxe_33_in3": 0.771, "Ma_33_inkip": 15.23, "Vag_33_lb": 4370.0, "Ixe_50_in4": 1.534, "Sxe_50_in3": 0.733, "Ma_50_inkip": 21.94, "Vag_50_lb": 6622.0, "Jx1000_in4": 2.315, "Cw_in6": 0.374, "Xo_in": -0.82, "m_in": 0.501, "Ro_in": 1.778, "beta_in": 0.787},
    "362T200-33": {"thickness_in": 0.0346, "area_in2": 0.264, "weight_lbft": 0.9, "Ix_in4": 0.619, "Sx_in3": 0.328, "Rx_in": 1.532, "Iy_in4": 0.11, "Ry_in": 0.645, "Ixe_33_in4": 0.464, "Sxe_33_in3": 0.19, "Ma_33_inkip": 3.76, "Vag_33_lb": 1024.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.105, "Cw_in6": 0.269, "Xo_in": -1.27, "m_in": 0.754, "Ro_in": 2.092, "beta_in": 0.631},
    "362T200-43": {"thickness_in": 0.0451, "area_in2": 0.343, "weight_lbft": 1.17, "Ix_in4": 0.808, "Sx_in3": 0.427, "Rx_in": 1.534, "Iy_in4": 0.142, "Ry_in": 0.643, "Ixe_33_in4": 0.649, "Sxe_33_in3": 0.27, "Ma_33_inkip": 5.34, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.233, "Cw_in6": 0.35, "Xo_in": -1.265, "m_in": 0.752, "Ro_in": 2.09, "beta_in": 0.633},
    "362T200-54": {"thickness_in": 0.0566, "area_in2": 0.431, "weight_lbft": 1.47, "Ix_in4": 1.024, "Sx_in3": 0.536, "Rx_in": 1.541, "Iy_in4": 0.177, "Ry_in": 0.64, "Ixe_33_in4": 0.879, "Sxe_33_in3": 0.372, "Ma_33_inkip": 7.35, "Vag_33_lb": 2480.0, "Ixe_50_in4": 0.832, "Sxe_50_in3": 0.345, "Ma_50_inkip": 10.34, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.46, "Cw_in6": 0.442, "Xo_in": -1.259, "m_in": 0.748, "Ro_in": 2.091, "beta_in": 0.637},
    "362T200-68": {"thickness_in": 0.0713, "area_in2": 0.543, "weight_lbft": 1.85, "Ix_in4": 1.307, "Sx_in3": 0.675, "Rx_in": 1.552, "Iy_in4": 0.221, "Ry_in": 0.638, "Ixe_33_in4": 1.199, "Sxe_33_in3": 0.519, "Ma_33_inkip": 10.26, "Vag_33_lb": 3104.0, "Ixe_50_in4": 1.138, "Sxe_50_in3": 0.48, "Ma_50_inkip": 14.37, "Vag_50_lb": 4703.0, "Jx1000_in4": 0.919, "Cw_in6": 0.564, "Xo_in": -1.25, "m_in": 0.743, "Ro_in": 2.093, "beta_in": 0.643},
    "362T200-97": {"thickness_in": 0.1017, "area_in2": 0.773, "weight_lbft": 2.63, "Ix_in4": 1.917, "Sx_in3": 0.963, "Rx_in": 1.575, "Iy_in4": 0.308, "Ry_in": 0.631, "Ixe_33_in4": 1.915, "Sxe_33_in3": 0.867, "Ma_33_inkip": 17.14, "Vag_33_lb": 4370.0, "Ixe_50_in4": 1.839, "Sxe_50_in3": 0.803, "Ma_50_inkip": 24.06, "Vag_50_lb": 6622.0, "Jx1000_in4": 2.666, "Cw_in6": 0.825, "Xo_in": -1.232, "m_in": 0.732, "Ro_in": 2.097, "beta_in": 0.655},
    "362T250-54": {"thickness_in": 0.0566, "area_in2": 0.488, "weight_lbft": 1.66, "Ix_in4": 1.225, "Sx_in3": 0.641, "Rx_in": 1.585, "Iy_in4": 0.324, "Ry_in": 0.816, "Ixe_33_in4": 0.971, "Sxe_33_in3": 0.389, "Ma_33_inkip": 7.69, "Vag_33_lb": 2480.0, "Ixe_50_in4": 0.914, "Sxe_50_in3": 0.36, "Ma_50_inkip": 10.77, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.521, "Cw_in6": 0.812, "Xo_in": -1.695, "m_in": 0.986, "Ro_in": 2.46, "beta_in": 0.525},
    "362T250-68": {"thickness_in": 0.0713, "area_in2": 0.614, "weight_lbft": 2.09, "Ix_in4": 1.565, "Sx_in3": 0.808, "Rx_in": 1.597, "Iy_in4": 0.406, "Ry_in": 0.813, "Ixe_33_in4": 1.337, "Sxe_33_in3": 0.546, "Ma_33_inkip": 10.79, "Vag_33_lb": 3104.0, "Ixe_50_in4": 1.259, "Sxe_50_in3": 0.503, "Ma_50_inkip": 15.04, "Vag_50_lb": 4703.0, "Jx1000_in4": 1.04, "Cw_in6": 1.038, "Xo_in": -1.686, "m_in": 0.98, "Ro_in": 2.46, "beta_in": 0.53},
    "362T250-97": {"thickness_in": 0.1017, "area_in2": 0.875, "weight_lbft": 2.98, "Ix_in4": 2.3, "Sx_in3": 1.155, "Rx_in": 1.621, "Iy_in4": 0.57, "Ry_in": 0.807, "Ixe_33_in4": 2.18, "Sxe_33_in3": 0.928, "Ma_33_inkip": 18.34, "Vag_33_lb": 4370.0, "Ixe_50_in4": 2.07, "Sxe_50_in3": 0.851, "Ma_50_inkip": 25.49, "Vag_50_lb": 6622.0, "Jx1000_in4": 3.016, "Cw_in6": 1.524, "Xo_in": -1.667, "m_in": 0.969, "Ro_in": 2.461, "beta_in": 0.541},
    "400T125-18": {"thickness_in": 0.0188, "area_in2": 0.122, "weight_lbft": 0.41, "Ix_in4": 0.297, "Sx_in3": 0.144, "Rx_in": 1.56, "Iy_in4": 0.017, "Ry_in": 0.374, "Ixe_33_in4": 0.241, "Sxe_33_in3": 0.072, "Ma_33_inkip": 1.42, "Vag_33_lb": 153.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.014, "Cw_in6": 0.052, "Xo_in": -0.637, "m_in": 0.4, "Ro_in": 1.726, "beta_in": 0.864},
    "400T125-27": {"thickness_in": 0.0283, "area_in2": 0.184, "weight_lbft": 0.63, "Ix_in4": 0.449, "Sx_in3": 0.217, "Rx_in": 1.562, "Iy_in4": 0.025, "Ry_in": 0.372, "Ixe_33_in4": 0.38, "Sxe_33_in3": 0.156, "Ma_33_inkip": 3.08, "Vag_33_lb": 515.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.049, "Cw_in6": 0.078, "Xo_in": -0.633, "m_in": 0.398, "Ro_in": 1.726, "beta_in": 0.866},
    "400T125-30": {"thickness_in": 0.0312, "area_in2": 0.203, "weight_lbft": 0.69, "Ix_in4": 0.495, "Sx_in3": 0.239, "Rx_in": 1.562, "Iy_in4": 0.028, "Ry_in": 0.371, "Ixe_33_in4": 0.427, "Sxe_33_in3": 0.176, "Ma_33_inkip": 3.49, "Vag_33_lb": 689.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.066, "Cw_in6": 0.085, "Xo_in": -0.632, "m_in": 0.397, "Ro_in": 1.726, "beta_in": 0.866},
    "400T125-33": {"thickness_in": 0.0346, "area_in2": 0.225, "weight_lbft": 0.76, "Ix_in4": 0.549, "Sx_in3": 0.265, "Rx_in": 1.563, "Iy_in4": 0.031, "Ry_in": 0.371, "Ixe_33_in4": 0.484, "Sxe_33_in3": 0.201, "Ma_33_inkip": 3.97, "Vag_33_lb": 940.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.09, "Cw_in6": 0.095, "Xo_in": -0.63, "m_in": 0.396, "Ro_in": 1.725, "beta_in": 0.867},
    "400T125-43": {"thickness_in": 0.0451, "area_in2": 0.293, "weight_lbft": 1.0, "Ix_in4": 0.716, "Sx_in3": 0.344, "Rx_in": 1.563, "Iy_in4": 0.04, "Ry_in": 0.369, "Ixe_33_in4": 0.666, "Sxe_33_in3": 0.282, "Ma_33_inkip": 5.57, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.198, "Cw_in6": 0.122, "Xo_in": -0.626, "m_in": 0.394, "Ro_in": 1.724, "beta_in": 0.868},
    "400T125-54": {"thickness_in": 0.0566, "area_in2": 0.367, "weight_lbft": 1.25, "Ix_in4": 0.904, "Sx_in3": 0.431, "Rx_in": 1.569, "Iy_in4": 0.049, "Ry_in": 0.366, "Ixe_33_in4": 0.882, "Sxe_33_in3": 0.381, "Ma_33_inkip": 7.53, "Vag_33_lb": 2739.0, "Ixe_50_in4": 0.849, "Sxe_50_in3": 0.359, "Ma_50_inkip": 10.74, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.392, "Cw_in6": 0.154, "Xo_in": -0.621, "m_in": 0.39, "Ro_in": 1.727, "beta_in": 0.871},
    "400T125-68": {"thickness_in": 0.0713, "area_in2": 0.462, "weight_lbft": 1.57, "Ix_in4": 1.15, "Sx_in3": 0.541, "Rx_in": 1.577, "Iy_in4": 0.061, "Ry_in": 0.363, "Ixe_33_in4": 1.15, "Sxe_33_in3": 0.517, "Ma_33_inkip": 10.22, "Vag_33_lb": 3435.0, "Ixe_50_in4": 1.134, "Sxe_50_in3": 0.488, "Ma_50_inkip": 14.62, "Vag_50_lb": 5205.0, "Jx1000_in4": 0.783, "Cw_in6": 0.194, "Xo_in": -0.614, "m_in": 0.386, "Ro_in": 1.731, "beta_in": 0.874},
    "400T125-97": {"thickness_in": 0.1017, "area_in2": 0.659, "weight_lbft": 2.24, "Ix_in4": 1.673, "Sx_in3": 0.768, "Rx_in": 1.594, "Iy_in4": 0.084, "Ry_in": 0.357, "Ixe_33_in4": 1.673, "Sxe_33_in3": 0.768, "Ma_33_inkip": 17.35, "Vag_33_lb": 4842.0, "Ixe_50_in4": 1.673, "Sxe_50_in3": 0.768, "Ma_50_inkip": 23.0, "Vag_50_lb": 7337.0, "Jx1000_in4": 2.271, "Cw_in6": 0.28, "Xo_in": -0.6, "m_in": 0.377, "Ro_in": 1.74, "beta_in": 0.881},
    "400T150-27": {"thickness_in": 0.0283, "area_in2": 0.198, "weight_lbft": 0.67, "Ix_in4": 0.509, "Sx_in3": 0.246, "Rx_in": 1.602, "Iy_in4": 0.042, "Ry_in": 0.461, "Ixe_33_in4": 0.409, "Sxe_33_in3": 0.154, "Ma_33_inkip": 3.04, "Vag_33_lb": 515.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.053, "Cw_in6": 0.127, "Xo_in": -0.824, "m_in": 0.509, "Ro_in": 1.86, "beta_in": 0.804},
    "400T150-30": {"thickness_in": 0.0312, "area_in2": 0.218, "weight_lbft": 0.74, "Ix_in4": 0.561, "Sx_in3": 0.271, "Rx_in": 1.603, "Iy_in4": 0.046, "Ry_in": 0.461, "Ixe_33_in4": 0.458, "Sxe_33_in3": 0.183, "Ma_33_inkip": 3.61, "Vag_33_lb": 689.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.071, "Cw_in6": 0.14, "Xo_in": -0.823, "m_in": 0.508, "Ro_in": 1.859, "beta_in": 0.804},
    "400T150-33": {"thickness_in": 0.0346, "area_in2": 0.242, "weight_lbft": 0.82, "Ix_in4": 0.622, "Sx_in3": 0.3, "Rx_in": 1.603, "Iy_in4": 0.051, "Ry_in": 0.46, "Ixe_33_in4": 0.519, "Sxe_33_in3": 0.208, "Ma_33_inkip": 4.12, "Vag_33_lb": 940.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.097, "Cw_in6": 0.155, "Xo_in": -0.821, "m_in": 0.507, "Ro_in": 1.859, "beta_in": 0.805},
    "400T150-43": {"thickness_in": 0.0451, "area_in2": 0.315, "weight_lbft": 1.07, "Ix_in4": 0.811, "Sx_in3": 0.39, "Rx_in": 1.604, "Iy_in4": 0.066, "Ry_in": 0.458, "Ixe_33_in4": 0.719, "Sxe_33_in3": 0.293, "Ma_33_inkip": 5.8, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.214, "Cw_in6": 0.2, "Xo_in": -0.817, "m_in": 0.504, "Ro_in": 1.857, "beta_in": 0.807},
    "400T150-54": {"thickness_in": 0.0566, "area_in2": 0.396, "weight_lbft": 1.35, "Ix_in4": 1.025, "Sx_in3": 0.489, "Rx_in": 1.61, "Iy_in4": 0.082, "Ry_in": 0.456, "Ixe_33_in4": 0.96, "Sxe_33_in3": 0.399, "Ma_33_inkip": 7.89, "Vag_33_lb": 2739.0, "Ixe_50_in4": 0.918, "Sxe_50_in3": 0.374, "Ma_50_inkip": 11.19, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.422, "Cw_in6": 0.252, "Xo_in": -0.811, "m_in": 0.501, "Ro_in": 1.86, "beta_in": 0.81},
    "400T150-68": {"thickness_in": 0.0713, "area_in2": 0.498, "weight_lbft": 1.69, "Ix_in4": 1.306, "Sx_in3": 0.615, "Rx_in": 1.619, "Iy_in4": 0.102, "Ry_in": 0.453, "Ixe_33_in4": 1.286, "Sxe_33_in3": 0.548, "Ma_33_inkip": 10.82, "Vag_33_lb": 3435.0, "Ixe_50_in4": 1.237, "Sxe_50_in3": 0.513, "Ma_50_inkip": 15.35, "Vag_50_lb": 5205.0, "Jx1000_in4": 0.844, "Cw_in6": 0.32, "Xo_in": -0.804, "m_in": 0.496, "Ro_in": 1.864, "beta_in": 0.814},
    "400T150-97": {"thickness_in": 0.1017, "area_in2": 0.71, "weight_lbft": 2.41, "Ix_in4": 1.903, "Sx_in3": 0.874, "Rx_in": 1.638, "Iy_in4": 0.141, "Ry_in": 0.447, "Ixe_33_in4": 1.903, "Sxe_33_in3": 0.874, "Ma_33_inkip": 17.27, "Vag_33_lb": 4842.0, "Ixe_50_in4": 1.903, "Sxe_50_in3": 0.832, "Ma_50_inkip": 24.92, "Vag_50_lb": 7337.0, "Jx1000_in4": 2.447, "Cw_in6": 0.463, "Xo_in": -0.788, "m_in": 0.487, "Ro_in": 1.872, "beta_in": 0.823},
    "400T200-33": {"thickness_in": 0.0346, "area_in2": 0.277, "weight_lbft": 0.94, "Ix_in4": 0.768, "Sx_in3": 0.371, "Rx_in": 1.666, "Iy_in4": 0.113, "Ry_in": 0.639, "Ixe_33_in4": 0.581, "Sxe_33_in3": 0.22, "Ma_33_inkip": 4.34, "Vag_33_lb": 940.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.11, "Cw_in6": 0.336, "Xo_in": -1.229, "m_in": 0.737, "Ro_in": 2.166, "beta_in": 0.678},
    "400T200-43": {"thickness_in": 0.0451, "area_in2": 0.36, "weight_lbft": 1.23, "Ix_in4": 1.002, "Sx_in3": 0.482, "Rx_in": 1.668, "Iy_in4": 0.146, "Ry_in": 0.637, "Ixe_33_in4": 0.811, "Sxe_33_in3": 0.311, "Ma_33_inkip": 6.14, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.244, "Cw_in6": 0.436, "Xo_in": -1.224, "m_in": 0.734, "Ro_in": 2.164, "beta_in": 0.68},
    "400T200-54": {"thickness_in": 0.0566, "area_in2": 0.452, "weight_lbft": 1.54, "Ix_in4": 1.268, "Sx_in3": 0.604, "Rx_in": 1.675, "Iy_in4": 0.182, "Ry_in": 0.635, "Ixe_33_in4": 1.093, "Sxe_33_in3": 0.426, "Ma_33_inkip": 8.42, "Vag_33_lb": 2739.0, "Ixe_50_in4": 1.037, "Sxe_50_in3": 0.397, "Ma_50_inkip": 11.88, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.483, "Cw_in6": 0.551, "Xo_in": -1.217, "m_in": 0.73, "Ro_in": 2.165, "beta_in": 0.684},
    "400T200-68": {"thickness_in": 0.0713, "area_in2": 0.569, "weight_lbft": 1.94, "Ix_in4": 1.617, "Sx_in3": 0.761, "Rx_in": 1.685, "Iy_in4": 0.227, "Ry_in": 0.632, "Ixe_33_in4": 1.485, "Sxe_33_in3": 0.591, "Ma_33_inkip": 11.68, "Vag_33_lb": 3435.0, "Ixe_50_in4": 1.412, "Sxe_50_in3": 0.549, "Ma_50_inkip": 16.42, "Vag_50_lb": 5205.0, "Jx1000_in4": 0.965, "Cw_in6": 0.702, "Xo_in": -1.209, "m_in": 0.725, "Ro_in": 2.168, "beta_in": 0.689},
    "400T200-97": {"thickness_in": 0.1017, "area_in2": 0.811, "weight_lbft": 2.76, "Ix_in4": 2.363, "Sx_in3": 1.085, "Rx_in": 1.707, "Iy_in4": 0.317, "Ry_in": 0.625, "Ixe_33_in4": 2.36, "Sxe_33_in3": 0.981, "Ma_33_inkip": 19.38, "Vag_33_lb": 4842.0, "Ixe_50_in4": 2.268, "Sxe_50_in3": 0.911, "Ma_50_inkip": 27.28, "Vag_50_lb": 7337.0, "Jx1000_in4": 2.797, "Cw_in6": 1.022, "Xo_in": -1.192, "m_in": 0.715, "Ro_in": 2.173, "beta_in": 0.699},
    "400T250-43": {"thickness_in": 0.0451, "area_in2": 0.406, "weight_lbft": 1.38, "Ix_in4": 1.193, "Sx_in3": 0.573, "Rx_in": 1.715, "Iy_in4": 0.268, "Ry_in": 0.813, "Ixe_33_in4": 0.888, "Sxe_33_in3": 0.324, "Ma_33_inkip": 6.4, "Vag_33_lb": 1739.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.275, "Cw_in6": 0.799, "Xo_in": -1.653, "m_in": 0.97, "Ro_in": 2.517, "beta_in": 0.569},
    "400T250-54": {"thickness_in": 0.0566, "area_in2": 0.509, "weight_lbft": 1.73, "Ix_in4": 1.511, "Sx_in3": 0.72, "Rx_in": 1.723, "Iy_in4": 0.335, "Ry_in": 0.811, "Ixe_33_in4": 1.205, "Sxe_33_in3": 0.445, "Ma_33_inkip": 8.8, "Vag_33_lb": 2739.0, "Ixe_50_in4": 1.137, "Sxe_50_in3": 0.414, "Ma_50_inkip": 12.38, "Vag_50_lb": 3372.0, "Jx1000_in4": 0.543, "Cw_in6": 1.011, "Xo_in": -1.646, "m_in": 0.966, "Ro_in": 2.517, "beta_in": 0.572},
    "400T250-68": {"thickness_in": 0.0713, "area_in2": 0.641, "weight_lbft": 2.18, "Ix_in4": 1.928, "Sx_in3": 0.908, "Rx_in": 1.735, "Iy_in4": 0.418, "Ry_in": 0.808, "Ixe_33_in4": 1.652, "Sxe_33_in3": 0.622, "Ma_33_inkip": 12.28, "Vag_33_lb": 3435.0, "Ixe_50_in4": 1.559, "Sxe_50_in3": 0.574, "Ma_50_inkip": 17.19, "Vag_50_lb": 5205.0, "Jx1000_in4": 1.086, "Cw_in6": 1.289, "Xo_in": -1.637, "m_in": 0.961, "Ro_in": 2.518, "beta_in": 0.578},
    "400T250-97": {"thickness_in": 0.1017, "area_in2": 0.913, "weight_lbft": 3.11, "Ix_in4": 2.824, "Sx_in3": 1.296, "Rx_in": 1.759, "Iy_in4": 0.588, "Ry_in": 0.802, "Ixe_33_in4": 2.679, "Sxe_33_in3": 1.049, "Ma_33_inkip": 20.72, "Vag_33_lb": 4842.0, "Ixe_50_in4": 2.546, "Sxe_50_in3": 0.965, "Ma_50_inkip": 28.89, "Vag_50_lb": 7337.0, "Jx1000_in4": 3.148, "Cw_in6": 1.886, "Xo_in": -1.618, "m_in": 0.95, "Ro_in": 2.521, "beta_in": 0.588},
    "550T125-18": {"thickness_in": null, "area_in2": 3.0, "weight_lbft": 0.0188, "Ix_in4": 0.15, "Sx_in3": 0.51, "Rx_in": 0.627, "Iy_in4": 0.223, "Ry_in": 2.044, "Ixe_33_in4": 0.018, "Sxe_33_in3": 0.349, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": null, "Cw_in6": null, "Xo_in": 0.018, "m_in": 0.108, "Ro_in": -0.547, "beta_in": 0.354},
    "550T125-27": {"thickness_in": 0.0283, "area_in2": 0.226, "weight_lbft": 0.77, "Ix_in4": 0.948, "Sx_in3": 0.336, "Rx_in": 2.046, "Iy_in4": 0.027, "Ry_in": 0.348, "Ixe_33_in4": 0.786, "Sxe_33_in3": 0.192, "Ma_33_inkip": 3.79, "Vag_33_lb": 372.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.06, "Cw_in6": 0.16, "Xo_in": -0.543, "m_in": 0.352, "Ro_in": 2.145, "beta_in": 0.936},
    "550T125-30": {"thickness_in": 0.0312, "area_in2": 0.25, "weight_lbft": 0.85, "Ix_in4": 1.045, "Sx_in3": 0.37, "Rx_in": 2.046, "Iy_in4": 0.03, "Ry_in": 0.347, "Ixe_33_in4": 0.897, "Sxe_33_in3": 0.226, "Ma_33_inkip": 4.47, "Vag_33_lb": 499.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.081, "Cw_in6": 0.176, "Xo_in": -0.542, "m_in": 0.351, "Ro_in": 2.145, "beta_in": 0.936},
    "550T125-33": {"thickness_in": 0.0346, "area_in2": 0.277, "weight_lbft": 0.94, "Ix_in4": 1.159, "Sx_in3": 0.41, "Rx_in": 2.046, "Iy_in4": 0.033, "Ry_in": 0.346, "Ixe_33_in4": 1.029, "Sxe_33_in3": 0.27, "Ma_33_inkip": 5.33, "Vag_33_lb": 680.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.11, "Cw_in6": 0.195, "Xo_in": -0.541, "m_in": 0.35, "Ro_in": 2.145, "beta_in": 0.936},
    "550T125-43": {"thickness_in": 0.0451, "area_in2": 0.36, "weight_lbft": 1.23, "Ix_in4": 1.51, "Sx_in3": 0.533, "Rx_in": 2.047, "Iy_in4": 0.043, "Ry_in": 0.344, "Ixe_33_in4": 1.428, "Sxe_33_in3": 0.416, "Ma_33_inkip": 8.23, "Vag_33_lb": 1504.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.244, "Cw_in6": 0.252, "Xo_in": -0.537, "m_in": 0.348, "Ro_in": 2.144, "beta_in": 0.937},
    "550T125-54": {"thickness_in": 0.0566, "area_in2": 0.452, "weight_lbft": 1.54, "Ix_in4": 1.903, "Sx_in3": 0.668, "Rx_in": 2.052, "Iy_in4": 0.053, "Ry_in": 0.342, "Ixe_33_in4": 1.862, "Sxe_33_in3": 0.597, "Ma_33_inkip": 11.8, "Vag_33_lb": 2739.0, "Ixe_50_in4": 1.811, "Sxe_50_in3": 0.535, "Ma_50_inkip": 16.01, "Vag_50_lb": 2980.0, "Jx1000_in4": 0.483, "Cw_in6": 0.315, "Xo_in": -0.532, "m_in": 0.345, "Ro_in": 2.147, "beta_in": 0.939},
    "550T125-68": {"thickness_in": 0.0713, "area_in2": 0.569, "weight_lbft": 1.94, "Ix_in4": 2.412, "Sx_in3": 0.839, "Rx_in": 2.058, "Iy_in4": 0.066, "Ry_in": 0.339, "Ixe_33_in4": 2.412, "Sxe_33_in3": 0.807, "Ma_33_inkip": 15.95, "Vag_33_lb": 4347.0, "Ixe_50_in4": 2.379, "Sxe_50_in3": 0.769, "Ma_50_inkip": 23.02, "Vag_50_lb": 5350.0, "Jx1000_in4": 0.965, "Cw_in6": 0.397, "Xo_in": -0.526, "m_in": 0.341, "Ro_in": 2.152, "beta_in": 0.94},
    "550T125-97": {"thickness_in": 0.1017, "area_in2": 0.811, "weight_lbft": 2.76, "Ix_in4": 3.483, "Sx_in3": 1.19, "Rx_in": 2.072, "Iy_in4": 0.09, "Ry_in": 0.333, "Ixe_33_in4": 3.483, "Sxe_33_in3": 1.19, "Ma_33_inkip": 26.87, "Vag_33_lb": 6730.0, "Ixe_50_in4": 3.483, "Sxe_50_in3": 1.19, "Ma_50_inkip": 35.62, "Vag_50_lb": 10197.0, "Jx1000_in4": 2.797, "Cw_in6": 0.564, "Xo_in": -0.514, "m_in": 0.333, "Ro_in": 2.161, "beta_in": 0.943},
    "550T150-27": {"thickness_in": 0.0283, "area_in2": 0.241, "weight_lbft": 0.82, "Ix_in4": 1.059, "Sx_in3": 0.376, "Rx_in": 2.098, "Iy_in4": 0.046, "Ry_in": 0.436, "Ixe_33_in4": 0.893, "Sxe_33_in3": 0.207, "Ma_33_inkip": 4.1, "Vag_33_lb": 372.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.064, "Cw_in6": 0.263, "Xo_in": -0.716, "m_in": 0.456, "Ro_in": 2.259, "beta_in": 0.9},
    "550T150-30": {"thickness_in": 0.0312, "area_in2": 0.265, "weight_lbft": 0.9, "Ix_in4": 1.168, "Sx_in3": 0.414, "Rx_in": 2.098, "Iy_in4": 0.05, "Ry_in": 0.435, "Ixe_33_in4": 0.995, "Sxe_33_in3": 0.251, "Ma_33_inkip": 4.96, "Vag_33_lb": 499.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.086, "Cw_in6": 0.289, "Xo_in": -0.715, "m_in": 0.455, "Ro_in": 2.259, "beta_in": 0.9},
    "550T150-33": {"thickness_in": 0.0346, "area_in2": 0.294, "weight_lbft": 1.0, "Ix_in4": 1.295, "Sx_in3": 0.459, "Rx_in": 2.099, "Iy_in4": 0.055, "Ry_in": 0.434, "Ixe_33_in4": 1.115, "Sxe_33_in3": 0.31, "Ma_33_inkip": 6.12, "Vag_33_lb": 680.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.117, "Cw_in6": 0.32, "Xo_in": -0.714, "m_in": 0.455, "Ro_in": 2.259, "beta_in": 0.9},
    "550T150-43": {"thickness_in": 0.0451, "area_in2": 0.383, "weight_lbft": 1.3, "Ix_in4": 1.688, "Sx_in3": 0.596, "Rx_in": 2.099, "Iy_in4": 0.072, "Ry_in": 0.432, "Ixe_33_in4": 1.516, "Sxe_33_in3": 0.468, "Ma_33_inkip": 9.25, "Vag_33_lb": 1504.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.26, "Cw_in6": 0.414, "Xo_in": -0.709, "m_in": 0.452, "Ro_in": 2.258, "beta_in": 0.901},
    "550T150-54": {"thickness_in": 0.0566, "area_in2": 0.48, "weight_lbft": 1.63, "Ix_in4": 2.128, "Sx_in3": 0.747, "Rx_in": 2.105, "Iy_in4": 0.089, "Ry_in": 0.43, "Ixe_33_in4": 2.005, "Sxe_33_in3": 0.628, "Ma_33_inkip": 12.41, "Vag_33_lb": 2739.0, "Ixe_50_in4": 1.928, "Sxe_50_in3": 0.595, "Ma_50_inkip": 17.81, "Vag_50_lb": 2980.0, "Jx1000_in4": 0.513, "Cw_in6": 0.519, "Xo_in": -0.704, "m_in": 0.449, "Ro_in": 2.261, "beta_in": 0.903},
    "550T150-68": {"thickness_in": 0.0713, "area_in2": 0.605, "weight_lbft": 2.06, "Ix_in4": 2.699, "Sx_in3": 0.939, "Rx_in": 2.112, "Iy_in4": 0.11, "Ry_in": 0.427, "Ixe_33_in4": 2.66, "Sxe_33_in3": 0.85, "Ma_33_inkip": 16.8, "Vag_33_lb": 4347.0, "Ixe_50_in4": 2.569, "Sxe_50_in3": 0.804, "Ma_50_inkip": 24.07, "Vag_50_lb": 5350.0, "Jx1000_in4": 1.025, "Cw_in6": 0.655, "Xo_in": -0.698, "m_in": 0.445, "Ro_in": 2.265, "beta_in": 0.905},
    "550T150-97": {"thickness_in": 0.1017, "area_in2": 0.862, "weight_lbft": 2.93, "Ix_in4": 3.904, "Sx_in3": 1.333, "Rx_in": 2.128, "Iy_in4": 0.153, "Ry_in": 0.421, "Ixe_33_in4": 3.904, "Sxe_33_in3": 1.333, "Ma_33_inkip": 26.35, "Vag_33_lb": 6730.0, "Ixe_50_in4": 3.904, "Sxe_50_in3": 1.278, "Ma_50_inkip": 38.27, "Vag_50_lb": 10197.0, "Jx1000_in4": 2.973, "Cw_in6": 0.937, "Xo_in": -0.684, "m_in": 0.436, "Ro_in": 2.275, "beta_in": 0.909},
    "550T200-33": {"thickness_in": 0.0346, "area_in2": 0.329, "weight_lbft": 1.12, "Ix_in4": 1.567, "Sx_in3": 0.555, "Rx_in": 2.184, "Iy_in4": 0.123, "Ry_in": 0.613, "Ixe_33_in4": 1.246, "Sxe_33_in3": 0.307, "Ma_33_inkip": 6.06, "Vag_33_lb": 680.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.131, "Cw_in6": 0.694, "Xo_in": -1.088, "m_in": 0.674, "Ro_in": 2.516, "beta_in": 0.813},
    "550T200-43": {"thickness_in": 0.0451, "area_in2": 0.428, "weight_lbft": 1.46, "Ix_in4": 2.043, "Sx_in3": 0.722, "Rx_in": 2.185, "Iy_in4": 0.16, "Ry_in": 0.611, "Ixe_33_in4": 1.69, "Sxe_33_in3": 0.495, "Ma_33_inkip": 9.79, "Vag_33_lb": 1504.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.29, "Cw_in6": 0.9, "Xo_in": -1.083, "m_in": 0.671, "Ro_in": 2.514, "beta_in": 0.814},
    "550T200-54": {"thickness_in": 0.0566, "area_in2": 0.537, "weight_lbft": 1.83, "Ix_in4": 2.578, "Sx_in3": 0.905, "Rx_in": 2.191, "Iy_in4": 0.199, "Ry_in": 0.609, "Ixe_33_in4": 2.253, "Sxe_33_in3": 0.669, "Ma_33_inkip": 13.21, "Vag_33_lb": 2739.0, "Ixe_50_in4": 2.153, "Sxe_50_in3": 0.63, "Ma_50_inkip": 18.86, "Vag_50_lb": 2980.0, "Jx1000_in4": 0.573, "Cw_in6": 1.133, "Xo_in": -1.077, "m_in": 0.668, "Ro_in": 2.517, "beta_in": 0.817},
    "550T200-68": {"thickness_in": 0.0713, "area_in2": 0.676, "weight_lbft": 2.3, "Ix_in4": 3.274, "Sx_in3": 1.139, "Rx_in": 2.2, "Iy_in4": 0.248, "Ry_in": 0.606, "Ixe_33_in4": 3.027, "Sxe_33_in3": 0.914, "Ma_33_inkip": 18.06, "Vag_33_lb": 4347.0, "Ixe_50_in4": 2.894, "Sxe_50_in3": 0.857, "Ma_50_inkip": 25.67, "Vag_50_lb": 5350.0, "Jx1000_in4": 1.146, "Cw_in6": 1.434, "Xo_in": -1.07, "m_in": 0.663, "Ro_in": 2.521, "beta_in": 0.82},
    "550T200-97": {"thickness_in": 0.1017, "area_in2": 0.964, "weight_lbft": 3.28, "Ix_in4": 4.746, "Sx_in3": 1.621, "Rx_in": 2.219, "Iy_in4": 0.347, "Ry_in": 0.6, "Ixe_33_in4": 4.735, "Sxe_33_in3": 1.483, "Ma_33_inkip": 29.3, "Vag_33_lb": 6730.0, "Ixe_50_in4": 4.566, "Sxe_50_in3": 1.391, "Ma_50_inkip": 41.64, "Vag_50_lb": 10197.0, "Jx1000_in4": 3.323, "Cw_in6": 2.067, "Xo_in": -1.055, "m_in": 0.653, "Ro_in": 2.529, "beta_in": 0.826},
    "550T250-43": {"thickness_in": 0.0451, "area_in2": 0.473, "weight_lbft": 1.61, "Ix_in4": 2.399, "Sx_in3": 0.848, "Rx_in": 2.252, "Iy_in4": 0.295, "Ry_in": 0.79, "Ixe_33_in4": 1.841, "Sxe_33_in3": 0.516, "Ma_33_inkip": 10.2, "Vag_33_lb": 1504.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.321, "Cw_in6": 1.643, "Xo_in": -1.484, "m_in": 0.899, "Ro_in": 2.81, "beta_in": 0.721},
    "550T250-54": {"thickness_in": 0.0566, "area_in2": 0.594, "weight_lbft": 2.02, "Ix_in4": 3.029, "Sx_in3": 1.063, "Rx_in": 2.259, "Iy_in4": 0.368, "Ry_in": 0.788, "Ixe_33_in4": 2.466, "Sxe_33_in3": 0.699, "Ma_33_inkip": 13.81, "Vag_33_lb": 2739.0, "Ixe_50_in4": 2.346, "Sxe_50_in3": 0.657, "Ma_50_inkip": 19.66, "Vag_50_lb": 2980.0, "Jx1000_in4": 0.634, "Cw_in6": 2.07, "Xo_in": -1.478, "m_in": 0.895, "Ro_in": 2.812, "beta_in": 0.724},
    "550T250-68": {"thickness_in": 0.0713, "area_in2": 0.748, "weight_lbft": 2.54, "Ix_in4": 3.849, "Sx_in3": 1.339, "Rx_in": 2.269, "Iy_in4": 0.46, "Ry_in": 0.785, "Ixe_33_in4": 3.338, "Sxe_33_in3": 0.96, "Ma_33_inkip": 18.97, "Vag_33_lb": 4347.0, "Ixe_50_in4": 3.173, "Sxe_50_in3": 0.897, "Ma_50_inkip": 26.86, "Vag_50_lb": 5350.0, "Jx1000_in4": 1.267, "Cw_in6": 2.627, "Xo_in": -1.47, "m_in": 0.89, "Ro_in": 2.815, "beta_in": 0.727},
    "550T250-97": {"thickness_in": 0.1017, "area_in2": 1.066, "weight_lbft": 3.63, "Ix_in4": 5.588, "Sx_in3": 1.908, "Rx_in": 2.29, "Iy_in4": 0.646, "Ry_in": 0.779, "Ixe_33_in4": 5.314, "Sxe_33_in3": 1.58, "Ma_33_inkip": 31.23, "Vag_33_lb": 6730.0, "Ixe_50_in4": 5.073, "Sxe_50_in3": 1.47, "Ma_50_inkip": 44.01, "Vag_50_lb": 10197.0, "Jx1000_in4": 3.674, "Cw_in6": 3.801, "Xo_in": -1.453, "m_in": 0.88, "Ro_in": 2.822, "beta_in": 0.735},
    "600T125-18": {"thickness_in": null, "area_in2": 3.0, "weight_lbft": 0.0188, "Ix_in4": 0.16, "Sx_in3": 0.54, "Rx_in": 0.776, "Iy_in4": 0.254, "Ry_in": 2.204, "Ixe_33_in4": 0.019, "Sxe_33_in3": 0.342, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": null, "Cw_in6": null, "Xo_in": 0.019, "m_in": 0.132, "Ro_in": -0.528, "beta_in": 0.347},
    "600T125-27": {"thickness_in": 0.0283, "area_in2": 0.241, "weight_lbft": 0.82, "Ix_in4": 1.168, "Sx_in3": 0.381, "Rx_in": 2.204, "Iy_in4": 0.028, "Ry_in": 0.34, "Ixe_33_in4": 0.958, "Sxe_33_in3": 0.21, "Ma_33_inkip": 4.16, "Vag_33_lb": 341.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.064, "Cw_in6": 0.196, "Xo_in": -0.519, "m_in": 0.339, "Ro_in": 2.29, "beta_in": 0.949},
    "600T125-30": {"thickness_in": 0.0312, "area_in2": 0.265, "weight_lbft": 0.9, "Ix_in4": 1.288, "Sx_in3": 0.419, "Rx_in": 2.204, "Iy_in4": 0.031, "Ry_in": 0.34, "Ixe_33_in4": 1.095, "Sxe_33_in3": 0.249, "Ma_33_inkip": 4.92, "Vag_33_lb": 456.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.086, "Cw_in6": 0.215, "Xo_in": -0.518, "m_in": 0.338, "Ro_in": 2.289, "beta_in": 0.949},
    "600T125-33": {"thickness_in": 0.0346, "area_in2": 0.294, "weight_lbft": 1.0, "Ix_in4": 1.428, "Sx_in3": 0.465, "Rx_in": 2.204, "Iy_in4": 0.034, "Ry_in": 0.339, "Ixe_33_in4": 1.258, "Sxe_33_in3": 0.297, "Ma_33_inkip": 5.87, "Vag_33_lb": 622.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.117, "Cw_in6": 0.238, "Xo_in": -0.516, "m_in": 0.337, "Ro_in": 2.289, "beta_in": 0.949},
    "600T125-43": {"thickness_in": 0.0451, "area_in2": 0.383, "weight_lbft": 1.3, "Ix_in4": 1.861, "Sx_in3": 0.604, "Rx_in": 2.205, "Iy_in4": 0.044, "Ry_in": 0.337, "Ixe_33_in4": 1.768, "Sxe_33_in3": 0.461, "Ma_33_inkip": 9.11, "Vag_33_lb": 1377.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.26, "Cw_in6": 0.307, "Xo_in": -0.513, "m_in": 0.335, "Ro_in": 2.288, "beta_in": 0.95},
    "600T125-54": {"thickness_in": 0.0566, "area_in2": 0.48, "weight_lbft": 1.63, "Ix_in4": 2.344, "Sx_in3": 0.756, "Rx_in": 2.209, "Iy_in4": 0.054, "Ry_in": 0.335, "Ixe_33_in4": 2.299, "Sxe_33_in3": 0.666, "Ma_33_inkip": 13.15, "Vag_33_lb": 2728.0, "Ixe_50_in4": 2.241, "Sxe_50_in3": 0.592, "Ma_50_inkip": 17.73, "Vag_50_lb": 2728.0, "Jx1000_in4": 0.513, "Cw_in6": 0.384, "Xo_in": -0.508, "m_in": 0.332, "Ro_in": 2.291, "beta_in": 0.951},
    "600T125-68": {"thickness_in": 0.0713, "area_in2": 0.605, "weight_lbft": 2.06, "Ix_in4": 2.969, "Sx_in3": 0.95, "Rx_in": 2.215, "Iy_in4": 0.067, "Ry_in": 0.332, "Ixe_33_in4": 2.969, "Sxe_33_in3": 0.916, "Ma_33_inkip": 18.09, "Vag_33_lb": 4347.0, "Ixe_50_in4": 2.934, "Sxe_50_in3": 0.858, "Ma_50_inkip": 25.69, "Vag_50_lb": 5350.0, "Jx1000_in4": 1.025, "Cw_in6": 0.483, "Xo_in": -0.503, "m_in": 0.329, "Ro_in": 2.296, "beta_in": 0.952},
    "600T125-97": {"thickness_in": 0.1017, "area_in2": 0.862, "weight_lbft": 2.93, "Ix_in4": 4.281, "Sx_in3": 1.347, "Rx_in": 2.228, "Iy_in4": 0.092, "Ry_in": 0.326, "Ixe_33_in4": 4.281, "Sxe_33_in3": 1.347, "Ma_33_inkip": 30.43, "Vag_33_lb": 2.0, "Ixe_50_in4": 7359.0, "Sxe_50_in3": 4.281, "Ma_50_inkip": 1.347, "Vag_50_lb": 40.33, "Jx1000_in4": 10885.0, "Cw_in6": 2.973, "Xo_in": 0.685, "m_in": -0.491, "Ro_in": 0.321, "beta_in": 2.305},
    "600T125-118": {"thickness_in": 0.1242, "area_in2": 1.052, "weight_lbft": 3.58, "Ix_in4": 5.268, "Sx_in3": 1.637, "Rx_in": 2.237, "Iy_in4": 0.109, "Ry_in": 0.322, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 5.268, "Sxe_50_in3": 1.637, "Ma_50_inkip": 56.32, "Vag_50_lb": 13539.0, "Jx1000_in4": 5.411, "Cw_in6": 0.832, "Xo_in": -0.483, "m_in": 0.315, "Ro_in": 2.311, "beta_in": 0.956},
    "600T150-27": {"thickness_in": 0.0283, "area_in2": 0.255, "weight_lbft": 0.87, "Ix_in4": 1.3, "Sx_in3": 0.424, "Rx_in": 2.26, "Iy_in4": 0.047, "Ry_in": 0.427, "Ixe_33_in4": 1.011, "Sxe_33_in3": 0.214, "Ma_33_inkip": 4.23, "Vag_33_lb": 341.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.068, "Cw_in6": 0.32, "Xo_in": -0.686, "m_in": 0.441, "Ro_in": 2.4, "beta_in": 0.918},
    "600T150-30": {"thickness_in": 0.0312, "area_in2": 0.281, "weight_lbft": 0.96, "Ix_in4": 1.434, "Sx_in3": 0.467, "Rx_in": 2.26, "Iy_in4": 0.051, "Ry_in": 0.427, "Ixe_33_in4": 1.159, "Sxe_33_in3": 0.253, "Ma_33_inkip": 5.01, "Vag_33_lb": 456.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.091, "Cw_in6": 0.352, "Xo_in": -0.685, "m_in": 0.44, "Ro_in": 2.4, "beta_in": 0.918},
    "600T150-33": {"thickness_in": 0.0346, "area_in2": 0.311, "weight_lbft": 1.06, "Ix_in4": 1.59, "Sx_in3": 0.517, "Rx_in": 2.26, "Iy_in4": 0.057, "Ry_in": 0.426, "Ixe_33_in4": 1.334, "Sxe_33_in3": 0.303, "Ma_33_inkip": 5.99, "Vag_33_lb": 622.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.124, "Cw_in6": 0.39, "Xo_in": -0.684, "m_in": 0.439, "Ro_in": 2.399, "beta_in": 0.919},
    "600T150-43": {"thickness_in": 0.0451, "area_in2": 0.405, "weight_lbft": 1.38, "Ix_in4": 2.072, "Sx_in3": 0.673, "Rx_in": 2.261, "Iy_in4": 0.073, "Ry_in": 0.424, "Ixe_33_in4": 1.89, "Sxe_33_in3": 0.474, "Ma_33_inkip": 9.36, "Vag_33_lb": 1377.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.275, "Cw_in6": 0.504, "Xo_in": -0.68, "m_in": 0.437, "Ro_in": 2.398, "beta_in": 0.92},
    "600T150-54": {"thickness_in": 0.0566, "area_in2": 0.509, "weight_lbft": 1.73, "Ix_in4": 2.611, "Sx_in3": 0.843, "Rx_in": 2.266, "Iy_in4": 0.091, "Ry_in": 0.422, "Ixe_33_in4": 2.473, "Sxe_33_in3": 0.689, "Ma_33_inkip": 13.62, "Vag_33_lb": 2728.0, "Ixe_50_in4": 2.4, "Sxe_50_in3": 0.609, "Ma_50_inkip": 18.24, "Vag_50_lb": 2728.0, "Jx1000_in4": 0.543, "Cw_in6": 0.632, "Xo_in": -0.675, "m_in": 0.434, "Ro_in": 2.401, "beta_in": 0.921},
    "600T150-68": {"thickness_in": 0.0713, "area_in2": 0.641, "weight_lbft": 2.18, "Ix_in4": 3.309, "Sx_in3": 1.059, "Rx_in": 2.273, "Iy_in4": 0.113, "Ry_in": 0.419, "Ixe_33_in4": 3.262, "Sxe_33_in3": 0.963, "Ma_33_inkip": 19.03, "Vag_33_lb": 4347.0, "Ixe_50_in4": 3.162, "Sxe_50_in3": 0.891, "Ma_50_inkip": 26.68, "Vag_50_lb": 5350.0, "Jx1000_in4": 1.086, "Cw_in6": 0.797, "Xo_in": -0.669, "m_in": 0.43, "Ro_in": 2.406, "beta_in": 0.923},
    "600T150-97": {"thickness_in": 0.1017, "area_in2": 0.913, "weight_lbft": 3.11, "Ix_in4": 4.778, "Sx_in3": 1.504, "Rx_in": 2.288, "Iy_in4": 0.156, "Ry_in": 0.413, "Ixe_33_in4": 4.778, "Sxe_33_in3": 1.504, "Ma_33_inkip": 29.71, "Vag_33_lb": 7359.0, "Ixe_50_in4": 4.778, "Sxe_50_in3": 1.444, "Ma_50_inkip": 43.23, "Vag_50_lb": 10885.0, "Jx1000_in4": 3.148, "Cw_in6": 1.138, "Xo_in": -0.656, "m_in": 0.421, "Ro_in": 2.415, "beta_in": 0.926},
    "600T150-118": {"thickness_in": 0.1242, "area_in2": 1.115, "weight_lbft": 3.79, "Ix_in4": 5.886, "Sx_in3": 1.829, "Rx_in": 2.298, "Iy_in4": 0.186, "Ry_in": 0.409, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 5.886, "Sxe_50_in3": 1.829, "Ma_50_inkip": 61.64, "Vag_50_lb": 13539.0, "Jx1000_in4": 5.73, "Cw_in6": 1.389, "Xo_in": -0.647, "m_in": 0.415, "Ro_in": 2.422, "beta_in": 0.929},
    "600T200-33": {"thickness_in": 0.0346, "area_in2": 0.346, "weight_lbft": 1.18, "Ix_in4": 1.913, "Sx_in3": 0.622, "Rx_in": 2.352, "Iy_in4": 0.126, "Ry_in": 0.604, "Ixe_33_in4": 1.542, "Sxe_33_in3": 0.333, "Ma_33_inkip": 6.59, "Vag_33_lb": 622.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.138, "Cw_in6": 0.847, "Xo_in": -1.048, "m_in": 0.655, "Ro_in": 2.645, "beta_in": 0.843},
    "600T200-43": {"thickness_in": 0.0451, "area_in2": 0.451, "weight_lbft": 1.53, "Ix_in4": 2.494, "Sx_in3": 0.809, "Rx_in": 2.353, "Iy_in4": 0.163, "Ry_in": 0.602, "Ixe_33_in4": 2.076, "Sxe_33_in3": 0.565, "Ma_33_inkip": 11.16, "Vag_33_lb": 1377.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.305, "Cw_in6": 1.098, "Xo_in": -1.044, "m_in": 0.652, "Ro_in": 2.643, "beta_in": 0.844},
    "600T200-54": {"thickness_in": 0.0566, "area_in2": 0.565, "weight_lbft": 1.92, "Ix_in4": 3.145, "Sx_in3": 1.015, "Rx_in": 2.359, "Iy_in4": 0.203, "Ry_in": 0.6, "Ixe_33_in4": 2.759, "Sxe_33_in3": 0.759, "Ma_33_inkip": 15.0, "Vag_33_lb": 2728.0, "Ixe_50_in4": 2.641, "Sxe_50_in3": 0.717, "Ma_50_inkip": 21.48, "Vag_50_lb": 2728.0, "Jx1000_in4": 0.604, "Cw_in6": 1.381, "Xo_in": -1.038, "m_in": 0.649, "Ro_in": 2.646, "beta_in": 0.846},
    "600T200-68": {"thickness_in": 0.0713, "area_in2": 0.712, "weight_lbft": 2.42, "Ix_in4": 3.99, "Sx_in3": 1.277, "Rx_in": 2.367, "Iy_in4": 0.254, "Ry_in": 0.597, "Ixe_33_in4": 3.696, "Sxe_33_in3": 1.034, "Ma_33_inkip": 20.42, "Vag_33_lb": 4347.0, "Ixe_50_in4": 3.54, "Sxe_50_in3": 0.973, "Ma_50_inkip": 29.12, "Vag_50_lb": 5350.0, "Jx1000_in4": 1.206, "Cw_in6": 1.746, "Xo_in": -1.031, "m_in": 0.644, "Ro_in": 2.65, "beta_in": 0.849},
    "600T200-97": {"thickness_in": 0.1017, "area_in2": 1.015, "weight_lbft": 3.45, "Ix_in4": 5.773, "Sx_in3": 1.816, "Rx_in": 2.385, "Iy_in4": 0.354, "Ry_in": 0.591, "Ixe_33_in4": 5.758, "Sxe_33_in3": 1.667, "Ma_33_inkip": 32.95, "Vag_33_lb": 7359.0, "Ixe_50_in4": 5.558, "Sxe_50_in3": 1.568, "Ma_50_inkip": 46.94, "Vag_50_lb": 10885.0, "Jx1000_in4": 3.499, "Cw_in6": 2.51, "Xo_in": -1.016, "m_in": 0.635, "Ro_in": 2.659, "beta_in": 0.854},
    "600T250-43": {"thickness_in": 0.0451, "area_in2": 0.496, "weight_lbft": 1.69, "Ix_in4": 2.916, "Sx_in3": 0.946, "Rx_in": 2.425, "Iy_in4": 0.303, "Ry_in": 0.781, "Ixe_33_in4": 2.269, "Sxe_33_in3": 0.563, "Ma_33_inkip": 11.13, "Vag_33_lb": 1377.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.336, "Cw_in6": 2.004, "Xo_in": -1.436, "m_in": 0.878, "Ro_in": 2.925, "beta_in": 0.759},
    "600T250-54": {"thickness_in": 0.0566, "area_in2": 0.622, "weight_lbft": 2.12, "Ix_in4": 3.678, "Sx_in3": 1.187, "Rx_in": 2.432, "Iy_in4": 0.377, "Ry_in": 0.779, "Ixe_33_in4": 3.014, "Sxe_33_in3": 0.794, "Ma_33_inkip": 15.68, "Vag_33_lb": 2728.0, "Ixe_50_in4": 2.881, "Sxe_50_in3": 0.732, "Ma_50_inkip": 21.92, "Vag_50_lb": 2728.0, "Jx1000_in4": 0.664, "Cw_in6": 2.523, "Xo_in": -1.43, "m_in": 0.874, "Ro_in": 2.927, "beta_in": 0.761},
    "600T250-68": {"thickness_in": 0.0713, "area_in2": 0.783, "weight_lbft": 2.67, "Ix_in4": 4.67, "Sx_in3": 1.495, "Rx_in": 2.442, "Iy_in4": 0.472, "Ry_in": 0.776, "Ixe_33_in4": 4.065, "Sxe_33_in3": 1.085, "Ma_33_inkip": 21.45, "Vag_33_lb": 4347.0, "Ixe_50_in4": 3.871, "Sxe_50_in3": 1.017, "Ma_50_inkip": 30.46, "Vag_50_lb": 5350.0, "Jx1000_in4": 1.327, "Cw_in6": 3.198, "Xo_in": -1.422, "m_in": 0.869, "Ro_in": 2.93, "beta_in": 0.764},
    "600T250-97": {"thickness_in": 0.1017, "area_in2": 1.117, "weight_lbft": 3.8, "Ix_in4": 6.767, "Sx_in3": 2.129, "Rx_in": 2.462, "Iy_in4": 0.662, "Ry_in": 0.77, "Ixe_33_in4": 6.441, "Sxe_33_in3": 1.775, "Ma_33_inkip": 35.08, "Vag_33_lb": 7359.0, "Ixe_50_in4": 6.158, "Sxe_50_in3": 1.656, "Ma_50_inkip": 49.58, "Vag_50_lb": 10885.0, "Jx1000_in4": 3.849, "Cw_in6": 4.616, "Xo_in": -1.406, "m_in": 0.859, "Ro_in": 2.938, "beta_in": 0.771},
    "600T250-118": {"thickness_in": 0.1242, "area_in2": 1.363, "weight_lbft": 4.64, "Ix_in4": 8.359, "Sx_in3": 2.598, "Rx_in": 2.477, "Iy_in4": 0.798, "Ry_in": 0.765, "Ixe_33_in4": 8.306, "Sxe_33_in3": 2.343, "Ma_33_inkip": 46.3, "Vag_33_lb": 8936.0, "Ixe_50_in4": 7.99, "Sxe_50_in3": 2.188, "Ma_50_inkip": 65.51, "Vag_50_lb": 13539.0, "Jx1000_in4": 7.008, "Cw_in6": 5.686, "Xo_in": -1.394, "m_in": 0.852, "Ro_in": 2.943, "beta_in": 0.776},
    "800T125-33": {"thickness_in": 0.0346, "area_in2": 0.363, "weight_lbft": 1.24, "Ix_in4": 2.895, "Sx_in3": 0.711, "Rx_in": 2.824, "Iy_in4": 0.036, "Ry_in": 0.313, "Ixe_33_in4": 2.441, "Sxe_33_in3": 0.407, "Ma_33_inkip": 8.03, "Vag_33_lb": 465.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.145, "Cw_in6": 0.456, "Xo_in": -0.439, "m_in": 0.294, "Ro_in": 2.875, "beta_in": 0.977},
    "800T125-43": {"thickness_in": 0.0451, "area_in2": 0.473, "weight_lbft": 1.61, "Ix_in4": 3.773, "Sx_in3": 0.924, "Rx_in": 2.824, "Iy_in4": 0.046, "Ry_in": 0.311, "Ixe_33_in4": 3.484, "Sxe_33_in3": 0.64, "Ma_33_inkip": 12.65, "Vag_33_lb": 1030.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.321, "Cw_in6": 0.589, "Xo_in": -0.436, "m_in": 0.292, "Ro_in": 2.874, "beta_in": 0.977},
    "800T125-54": {"thickness_in": 0.0566, "area_in2": 0.594, "weight_lbft": 2.02, "Ix_in4": 4.745, "Sx_in3": 1.158, "Rx_in": 2.827, "Iy_in4": 0.057, "Ry_in": 0.309, "Ixe_33_in4": 4.668, "Sxe_33_in3": 0.94, "Ma_33_inkip": 18.58, "Vag_33_lb": 2039.0, "Ixe_50_in4": 4.426, "Sxe_50_in3": 0.824, "Ma_50_inkip": 24.66, "Vag_50_lb": 2039.0, "Jx1000_in4": 0.634, "Cw_in6": 0.735, "Xo_in": -0.432, "m_in": 0.289, "Ro_in": 2.877, "beta_in": 0.977},
    "800T125-68": {"thickness_in": 0.0713, "area_in2": 0.748, "weight_lbft": 2.54, "Ix_in4": 5.998, "Sx_in3": 1.454, "Rx_in": 2.833, "Iy_in4": 0.07, "Ry_in": 0.306, "Ixe_33_in4": 5.998, "Sxe_33_in3": 1.356, "Ma_33_inkip": 26.8, "Vag_33_lb": 4087.0, "Ixe_50_in4": 5.956, "Sxe_50_in3": 1.216, "Ma_50_inkip": 36.39, "Vag_50_lb": 4087.0, "Jx1000_in4": 1.267, "Cw_in6": 0.92, "Xo_in": -0.427, "m_in": 0.286, "Ro_in": 2.881, "beta_in": 0.978},
    "800T125-97": {"thickness_in": 0.1017, "area_in2": 1.066, "weight_lbft": 3.63, "Ix_in4": 8.613, "Sx_in3": 2.062, "Rx_in": 2.843, "Iy_in4": 0.096, "Ry_in": 0.301, "Ixe_33_in4": 8.613, "Sxe_33_in3": 2.062, "Ma_33_inkip": 40.74, "Vag_33_lb": 8843.0, "Ixe_50_in4": 8.613, "Sxe_50_in3": 2.062, "Ma_50_inkip": 61.72, "Vag_50_lb": 10885.0, "Jx1000_in4": 3.674, "Cw_in6": 1.296, "Xo_in": -0.417, "m_in": 0.279, "Ro_in": 2.889, "beta_in": 0.979},
    "800T125-118": {"thickness_in": 0.1242, "area_in2": 1.301, "weight_lbft": 4.43, "Ix_in4": 10.569, "Sx_in3": 2.506, "Rx_in": 2.85, "Iy_in4": 0.114, "Ry_in": 0.297, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 10.569, "Sxe_50_in3": 2.506, "Ma_50_inkip": 86.21, "Vag_50_lb": 16235.0, "Jx1000_in4": 6.688, "Cw_in6": 1.567, "Xo_in": -0.41, "m_in": 0.274, "Ro_in": 2.895, "beta_in": 0.98},
    "800T150-33": {"thickness_in": 0.0346, "area_in2": 0.38, "weight_lbft": 1.29, "Ix_in4": 3.18, "Sx_in3": 0.781, "Rx_in": 2.891, "Iy_in4": 0.06, "Ry_in": 0.397, "Ixe_33_in4": 2.569, "Sxe_33_in3": 0.414, "Ma_33_inkip": 8.18, "Vag_33_lb": 465.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.152, "Cw_in6": 0.751, "Xo_in": -0.588, "m_in": 0.388, "Ro_in": 2.977, "beta_in": 0.961},
    "800T150-43": {"thickness_in": 0.0451, "area_in2": 0.496, "weight_lbft": 1.69, "Ix_in4": 4.144, "Sx_in3": 1.015, "Rx_in": 2.891, "Iy_in4": 0.077, "Ry_in": 0.395, "Ixe_33_in4": 3.689, "Sxe_33_in3": 0.655, "Ma_33_inkip": 12.95, "Vag_33_lb": 1030.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.336, "Cw_in6": 0.972, "Xo_in": -0.584, "m_in": 0.386, "Ro_in": 2.976, "beta_in": 0.961},
    "800T150-54": {"thickness_in": 0.0566, "area_in2": 0.622, "weight_lbft": 2.12, "Ix_in4": 5.214, "Sx_in3": 1.272, "Rx_in": 2.896, "Iy_in4": 0.096, "Ry_in": 0.393, "Ixe_33_in4": 4.976, "Sxe_33_in3": 0.969, "Ma_33_inkip": 19.15, "Vag_33_lb": 2039.0, "Ixe_50_in4": 4.692, "Sxe_50_in3": 0.844, "Ma_50_inkip": 25.27, "Vag_50_lb": 2039.0, "Jx1000_in4": 0.664, "Cw_in6": 1.215, "Xo_in": -0.58, "m_in": 0.383, "Ro_in": 2.979, "beta_in": 0.962},
    "800T150-68": {"thickness_in": 0.0713, "area_in2": 0.783, "weight_lbft": 2.67, "Ix_in4": 6.594, "Sx_in3": 1.599, "Rx_in": 2.902, "Iy_in4": 0.119, "Ry_in": 0.39, "Ixe_33_in4": 6.527, "Sxe_33_in3": 1.412, "Ma_33_inkip": 27.91, "Vag_33_lb": 4087.0, "Ixe_50_in4": 6.361, "Sxe_50_in3": 1.255, "Ma_50_inkip": 37.58, "Vag_50_lb": 4087.0, "Jx1000_in4": 1.327, "Cw_in6": 1.526, "Xo_in": -0.575, "m_in": 0.379, "Ro_in": 2.984, "beta_in": 0.963},
    "800T150-97": {"thickness_in": 0.1017, "area_in2": 1.116, "weight_lbft": 3.8, "Ix_in4": 9.479, "Sx_in3": 2.269, "Rx_in": 2.914, "Iy_in4": 0.165, "Ry_in": 0.384, "Ixe_33_in4": 9.479, "Sxe_33_in3": 2.269, "Ma_33_inkip": 44.83, "Vag_33_lb": 8843.0, "Ixe_50_in4": 9.479, "Sxe_50_in3": 2.192, "Ma_50_inkip": 65.62, "Vag_50_lb": 10885.0, "Jx1000_in4": 3.849, "Cw_in6": 2.162, "Xo_in": -0.564, "m_in": 0.372, "Ro_in": 2.993, "beta_in": 0.965},
    "800T150-118": {"thickness_in": 0.1242, "area_in2": 1.363, "weight_lbft": 4.64, "Ix_in4": 11.641, "Sx_in3": 2.76, "Rx_in": 2.923, "Iy_in4": 0.197, "Ry_in": 0.38, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 11.641, "Sxe_50_in3": 2.76, "Ma_50_inkip": 93.0, "Vag_50_lb": 16235.0, "Jx1000_in4": 7.008, "Cw_in6": 2.627, "Xo_in": -0.555, "m_in": 0.366, "Ro_in": 2.999, "beta_in": 0.966},
    "800T200-33": {"thickness_in": 0.0346, "area_in2": 0.415, "weight_lbft": 1.41, "Ix_in4": 3.749, "Sx_in3": 0.921, "Rx_in": 3.005, "Iy_in4": 0.135, "Ry_in": 0.571, "Ixe_33_in4": 2.788, "Sxe_33_in3": 0.424, "Ma_33_inkip": 8.37, "Vag_33_lb": 465.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.166, "Cw_in6": 1.638, "Xo_in": -0.917, "m_in": 0.589, "Ro_in": 3.194, "beta_in": 0.918},
    "800T200-43": {"thickness_in": 0.0451, "area_in2": 0.541, "weight_lbft": 1.84, "Ix_in4": 4.887, "Sx_in3": 1.197, "Rx_in": 3.006, "Iy_in4": 0.175, "Ry_in": 0.569, "Ixe_33_in4": 4.043, "Sxe_33_in3": 0.676, "Ma_33_inkip": 13.35, "Vag_33_lb": 1030.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.367, "Cw_in6": 2.124, "Xo_in": -0.913, "m_in": 0.587, "Ro_in": 3.193, "beta_in": 0.918},
    "800T200-54": {"thickness_in": 0.0566, "area_in2": 0.679, "weight_lbft": 2.31, "Ix_in4": 6.152, "Sx_in3": 1.501, "Rx_in": 3.011, "Iy_in4": 0.218, "Ry_in": 0.567, "Ixe_33_in4": 5.505, "Sxe_33_in3": 1.009, "Ma_33_inkip": 19.93, "Vag_33_lb": 2039.0, "Ixe_50_in4": 5.149, "Sxe_50_in3": 0.871, "Ma_50_inkip": 26.09, "Vag_50_lb": 2039.0, "Jx1000_in4": 0.725, "Cw_in6": 2.664, "Xo_in": -0.908, "m_in": 0.584, "Ro_in": 3.196, "beta_in": 0.919},
    "800T200-68": {"thickness_in": 0.0713, "area_in2": 0.854, "weight_lbft": 2.91, "Ix_in4": 7.786, "Sx_in3": 1.888, "Rx_in": 3.019, "Iy_in4": 0.272, "Ry_in": 0.564, "Ixe_33_in4": 7.306, "Sxe_33_in3": 1.49, "Ma_33_inkip": 29.45, "Vag_33_lb": 4087.0, "Ixe_50_in4": 7.051, "Sxe_50_in3": 1.31, "Ma_50_inkip": 39.22, "Vag_50_lb": 4087.0, "Jx1000_in4": 1.448, "Cw_in6": 3.357, "Xo_in": -0.902, "m_in": 0.58, "Ro_in": 3.201, "beta_in": 0.921},
    "800T200-97": {"thickness_in": 0.1017, "area_in2": 1.218, "weight_lbft": 4.15, "Ix_in4": 11.212, "Sx_in3": 2.683, "Rx_in": 3.034, "Iy_in4": 0.379, "Ry_in": 0.558, "Ixe_33_in4": 11.176, "Sxe_33_in3": 2.491, "Ma_33_inkip": 49.22, "Vag_33_lb": 8843.0, "Ixe_50_in4": 10.833, "Sxe_50_in3": 2.347, "Ma_50_inkip": 70.27, "Vag_50_lb": 10885.0, "Jx1000_in4": 4.2, "Cw_in6": 4.792, "Xo_in": -0.889, "m_in": 0.571, "Ro_in": 3.21, "beta_in": 0.923},
    "800T200-118": {"thickness_in": 0.1242, "area_in2": 1.487, "weight_lbft": 5.06, "Ix_in4": 13.785, "Sx_in3": 3.269, "Rx_in": 3.045, "Iy_in4": 0.455, "Ry_in": 0.553, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 13.785, "Sxe_50_in3": 3.059, "Ma_50_inkip": 91.59, "Vag_50_lb": 16235.0, "Jx1000_in4": 7.646, "Cw_in6": 5.854, "Xo_in": -0.879, "m_in": 0.565, "Ro_in": 3.217, "beta_in": 0.925},
    "800T250-43": {"thickness_in": 0.0451, "area_in2": 0.586, "weight_lbft": 1.99, "Ix_in4": 5.629, "Sx_in3": 1.38, "Rx_in": 3.1, "Iy_in4": 0.326, "Ry_in": 0.746, "Ixe_33_in4": 4.593, "Sxe_33_in3": 0.739, "Ma_33_inkip": 14.6, "Vag_33_lb": 1030.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.397, "Cw_in6": 3.877, "Xo_in": -1.274, "m_in": 0.801, "Ro_in": 3.433, "beta_in": 0.862},
    "800T250-54": {"thickness_in": 0.0566, "area_in2": 0.735, "weight_lbft": 2.5, "Ix_in4": 7.09, "Sx_in3": 1.73, "Rx_in": 3.106, "Iy_in4": 0.407, "Ry_in": 0.744, "Ixe_33_in4": 5.948, "Sxe_33_in3": 1.193, "Ma_33_inkip": 23.57, "Vag_33_lb": 2039.0, "Ixe_50_in4": 5.816, "Sxe_50_in3": 0.959, "Ma_50_inkip": 28.71, "Vag_50_lb": 2039.0, "Jx1000_in4": 0.785, "Cw_in6": 4.87, "Xo_in": -1.268, "m_in": 0.798, "Ro_in": 3.436, "beta_in": 0.864},
    "800T250-68": {"thickness_in": 0.0713, "area_in2": 0.926, "weight_lbft": 3.15, "Ix_in4": 8.978, "Sx_in3": 2.177, "Rx_in": 3.114, "Iy_in4": 0.509, "Ry_in": 0.741, "Ixe_33_in4": 7.917, "Sxe_33_in3": 1.648, "Ma_33_inkip": 32.57, "Vag_33_lb": 4087.0, "Ixe_50_in4": 7.588, "Sxe_50_in3": 1.56, "Ma_50_inkip": 46.72, "Vag_50_lb": 4087.0, "Jx1000_in4": 1.569, "Cw_in6": 6.151, "Xo_in": -1.261, "m_in": 0.793, "Ro_in": 3.441, "beta_in": 0.866},
    "800T250-97": {"thickness_in": 0.1017, "area_in2": 1.32, "weight_lbft": 4.49, "Ix_in4": 12.944, "Sx_in3": 3.098, "Rx_in": 3.132, "Iy_in4": 0.713, "Ry_in": 0.735, "Ixe_33_in4": 12.361, "Sxe_33_in3": 2.641, "Ma_33_inkip": 52.19, "Vag_33_lb": 8843.0, "Ixe_50_in4": 11.872, "Sxe_50_in3": 2.487, "Ma_50_inkip": 74.47, "Vag_50_lb": 10885.0, "Jx1000_in4": 4.55, "Cw_in6": 8.818, "Xo_in": -1.247, "m_in": 0.784, "Ro_in": 3.45, "beta_in": 0.869},
    "800T250-118": {"thickness_in": 0.1242, "area_in2": 1.611, "weight_lbft": 5.48, "Ix_in4": 15.93, "Sx_in3": 3.777, "Rx_in": 3.144, "Iy_in4": 0.86, "Ry_in": 0.731, "Ixe_33_in4": 15.822, "Sxe_33_in3": 3.448, "Ma_33_inkip": 68.14, "Vag_33_lb": 12009.0, "Ixe_50_in4": 15.272, "Sxe_50_in3": 3.248, "Ma_50_inkip": 97.26, "Vag_50_lb": 16235.0, "Jx1000_in4": 8.285, "Cw_in6": 10.807, "Xo_in": -1.236, "m_in": 0.777, "Ro_in": 3.457, "beta_in": 0.872},
    "1000T125-43": {"thickness_in": 0.0451, "area_in2": 0.563, "weight_lbft": 1.92, "Ix_in4": 6.63, "Sx_in3": 1.305, "Rx_in": 3.431, "Iy_in4": 0.047, "Ry_in": 0.29, "Ixe_33_in4": 5.886, "Sxe_33_in3": 0.819, "Ma_33_inkip": 16.19, "Vag_33_lb": 822.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.382, "Cw_in6": 0.973, "Xo_in": -0.379, "m_in": 0.259, "Ro_in": 3.464, "beta_in": 0.988},
    "1000T125-54": {"thickness_in": 0.0566, "area_in2": 0.707, "weight_lbft": 2.41, "Ix_in4": 8.333, "Sx_in3": 1.634, "Rx_in": 3.434, "Iy_in4": 0.059, "Ry_in": 0.288, "Ixe_33_in4": 7.96, "Sxe_33_in3": 1.216, "Ma_33_inkip": 24.03, "Vag_33_lb": 1628.0, "Ixe_50_in4": 7.479, "Sxe_50_in3": 1.055, "Ma_50_inkip": 31.59, "Vag_50_lb": 1628.0, "Jx1000_in4": 0.755, "Cw_in6": 1.212, "Xo_in": -0.376, "m_in": 0.256, "Ro_in": 3.466, "beta_in": 0.988},
    "1000T125-68": {"thickness_in": 0.0713, "area_in2": 0.89, "weight_lbft": 3.03, "Ix_in4": 10.522, "Sx_in3": 2.053, "Rx_in": 3.438, "Iy_in4": 0.073, "Ry_in": 0.286, "Ixe_33_in4": 10.452, "Sxe_33_in3": 1.781, "Ma_33_inkip": 35.19, "Vag_33_lb": 3261.0, "Ixe_50_in4": 10.155, "Sxe_50_in3": 1.575, "Ma_50_inkip": 47.15, "Vag_50_lb": 3261.0, "Jx1000_in4": 1.508, "Cw_in6": 1.515, "Xo_in": -0.372, "m_in": 0.253, "Ro_in": 3.47, "beta_in": 0.989},
    "1000T125-97": {"thickness_in": 0.1017, "area_in2": 1.269, "weight_lbft": 4.32, "Ix_in4": 15.077, "Sx_in3": 2.912, "Rx_in": 3.447, "Iy_in4": 0.1, "Ry_in": 0.28, "Ixe_33_in4": 15.077, "Sxe_33_in3": 2.907, "Ma_33_inkip": 57.44, "Vag_33_lb": 8843.0, "Ixe_50_in4": 15.077, "Sxe_50_in3": 2.753, "Ma_50_inkip": 82.42, "Vag_50_lb": 9507.0, "Jx1000_in4": 4.375, "Cw_in6": 2.123, "Xo_in": -0.363, "m_in": 0.247, "Ro_in": 3.477, "beta_in": 0.989},
    "1000T125-118": {"thickness_in": 0.1242, "area_in2": 1.549, "weight_lbft": 5.27, "Ix_in4": 18.471, "Sx_in3": 3.54, "Rx_in": 3.453, "Iy_in4": 0.118, "Ry_in": 0.276, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 18.471, "Sxe_50_in3": 3.535, "Ma_50_inkip": 105.85, "Vag_50_lb": 16235.0, "Jx1000_in4": 7.966, "Cw_in6": 2.558, "Xo_in": -0.357, "m_in": 0.243, "Ro_in": 3.482, "beta_in": 0.99},
    "1000T150-43": {"thickness_in": 0.0451, "area_in2": 0.586, "weight_lbft": 1.99, "Ix_in4": 7.207, "Sx_in3": 1.419, "Rx_in": 3.507, "Iy_in4": 0.08, "Ry_in": 0.37, "Ixe_33_in4": 6.195, "Sxe_33_in3": 0.837, "Ma_33_inkip": 16.54, "Vag_33_lb": 822.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.397, "Cw_in6": 1.612, "Xo_in": -0.513, "m_in": 0.345, "Ro_in": 3.564, "beta_in": 0.979},
    "1000T150-54": {"thickness_in": 0.0566, "area_in2": 0.735, "weight_lbft": 2.5, "Ix_in4": 9.061, "Sx_in3": 1.777, "Rx_in": 3.511, "Iy_in4": 0.1, "Ry_in": 0.368, "Ixe_33_in4": 8.43, "Sxe_33_in3": 1.249, "Ma_33_inkip": 24.69, "Vag_33_lb": 1628.0, "Ixe_50_in4": 7.88, "Sxe_50_in3": 1.079, "Ma_50_inkip": 32.29, "Vag_50_lb": 1628.0, "Jx1000_in4": 0.785, "Cw_in6": 2.013, "Xo_in": -0.509, "m_in": 0.342, "Ro_in": 3.567, "beta_in": 0.98},
    "1000T150-68": {"thickness_in": 0.0713, "area_in2": 0.926, "weight_lbft": 3.15, "Ix_in4": 11.445, "Sx_in3": 2.233, "Rx_in": 3.516, "Iy_in4": 0.124, "Ry_in": 0.366, "Ixe_33_in4": 11.342, "Sxe_33_in3": 1.846, "Ma_33_inkip": 36.48, "Vag_33_lb": 3261.0, "Ixe_50_in4": 10.774, "Sxe_50_in3": 1.621, "Ma_50_inkip": 48.53, "Vag_50_lb": 3261.0, "Jx1000_in4": 1.569, "Cw_in6": 2.522, "Xo_in": -0.505, "m_in": 0.339, "Ro_in": 3.571, "beta_in": 0.98},
    "1000T150-97": {"thickness_in": 0.1017, "area_in2": 1.32, "weight_lbft": 4.49, "Ix_in4": 16.413, "Sx_in3": 3.17, "Rx_in": 3.526, "Iy_in4": 0.171, "Ry_in": 0.36, "Ixe_33_in4": 16.413, "Sxe_33_in3": 3.165, "Ma_33_inkip": 62.54, "Vag_33_lb": 8843.0, "Ixe_50_in4": 16.413, "Sxe_50_in3": 2.902, "Ma_50_inkip": 86.9, "Vag_50_lb": 9507.0, "Jx1000_in4": 4.55, "Cw_in6": 3.557, "Xo_in": -0.495, "m_in": 0.332, "Ro_in": 3.579, "beta_in": 0.981},
    "1000T150-118": {"thickness_in": 0.1242, "area_in2": 1.611, "weight_lbft": 5.48, "Ix_in4": 20.121, "Sx_in3": 3.857, "Rx_in": 3.534, "Iy_in4": 0.204, "Ry_in": 0.356, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 20.121, "Sxe_50_in3": 3.852, "Ma_50_inkip": 115.32, "Vag_50_lb": 16235.0, "Jx1000_in4": 8.285, "Cw_in6": 4.307, "Xo_in": -0.488, "m_in": 0.328, "Ro_in": 3.585, "beta_in": 0.982},
    "1000T200-43": {"thickness_in": 0.0451, "area_in2": 0.631, "weight_lbft": 2.15, "Ix_in4": 8.361, "Sx_in3": 1.646, "Rx_in": 3.64, "Iy_in4": 0.183, "Ry_in": 0.539, "Ixe_33_in4": 6.722, "Sxe_33_in3": 0.861, "Ma_33_inkip": 17.01, "Vag_33_lb": 822.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.428, "Cw_in6": 3.54, "Xo_in": -0.813, "m_in": 0.534, "Ro_in": 3.769, "beta_in": 0.953},
    "1000T200-54": {"thickness_in": 0.0566, "area_in2": 0.792, "weight_lbft": 2.69, "Ix_in4": 10.516, "Sx_in3": 2.062, "Rx_in": 3.645, "Iy_in4": 0.228, "Ry_in": 0.537, "Ixe_33_in4": 9.231, "Sxe_33_in3": 1.295, "Ma_33_inkip": 25.6, "Vag_33_lb": 1628.0, "Ixe_50_in4": 8.56, "Sxe_50_in3": 1.111, "Ma_50_inkip": 33.26, "Vag_50_lb": 1628.0, "Jx1000_in4": 0.845, "Cw_in6": 4.434, "Xo_in": -0.809, "m_in": 0.531, "Ro_in": 3.772, "beta_in": 0.954},
    "1000T200-68": {"thickness_in": 0.0713, "area_in2": 0.997, "weight_lbft": 3.39, "Ix_in4": 13.292, "Sx_in3": 2.594, "Rx_in": 3.651, "Iy_in4": 0.284, "Ry_in": 0.534, "Ixe_33_in4": 12.551, "Sxe_33_in3": 1.936, "Ma_33_inkip": 38.26, "Vag_33_lb": 3261.0, "Ixe_50_in4": 11.82, "Sxe_50_in3": 1.684, "Ma_50_inkip": 50.42, "Vag_50_lb": 3261.0, "Jx1000_in4": 1.69, "Cw_in6": 5.576, "Xo_in": -0.803, "m_in": 0.527, "Ro_in": 3.776, "beta_in": 0.955},
    "1000T200-97": {"thickness_in": 0.1017, "area_in2": 1.422, "weight_lbft": 4.84, "Ix_in4": 19.087, "Sx_in3": 3.686, "Rx_in": 3.664, "Iy_in4": 0.397, "Ry_in": 0.528, "Ixe_33_in4": 19.031, "Sxe_33_in3": 3.427, "Ma_33_inkip": 67.72, "Vag_33_lb": 8843.0, "Ixe_50_in4": 18.583, "Sxe_50_in3": 3.081, "Ma_50_inkip": 92.25, "Vag_50_lb": 9507.0, "Jx1000_in4": 4.901, "Cw_in6": 7.924, "Xo_in": -0.791, "m_in": 0.519, "Ro_in": 3.786, "beta_in": 0.956},
    "1000T200-118": {"thickness_in": 0.1242, "area_in2": 1.736, "weight_lbft": 5.91, "Ix_in4": 23.422, "Sx_in3": 4.489, "Rx_in": 3.674, "Iy_in4": 0.476, "Ry_in": 0.524, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 23.422, "Sxe_50_in3": 4.208, "Ma_50_inkip": 125.99, "Vag_50_lb": 16235.0, "Jx1000_in4": 8.924, "Cw_in6": 9.649, "Xo_in": -0.783, "m_in": 0.514, "Ro_in": 3.793, "beta_in": 0.957},
    "1000T250-43": {"thickness_in": 0.0451, "area_in2": 0.676, "weight_lbft": 2.3, "Ix_in4": 9.515, "Sx_in3": 1.873, "Rx_in": 3.752, "Iy_in4": 0.344, "Ry_in": 0.713, "Ixe_33_in4": 7.172, "Sxe_33_in3": 0.376, "Ma_33_inkip": 17.32, "Vag_33_lb": 822.0, "Ixe_50_in4": null, "Sxe_50_in3": null, "Ma_50_inkip": null, "Vag_50_lb": null, "Jx1000_in4": 0.458, "Cw_in6": 6.477, "Xo_in": -1.147, "m_in": 0.737, "Ro_in": 3.987, "beta_in": 0.917},
    "1000T250-54": {"thickness_in": 0.0566, "area_in2": 0.848, "weight_lbft": 2.89, "Ix_in4": 11.972, "Sx_in3": 2.348, "Rx_in": 3.577, "Iy_in4": 0.429, "Ry_in": 0.711, "Ixe_33_in4": 9.913, "Sxe_33_in3": 1.326, "Ma_33_inkip": 26.2, "Vag_33_lb": 1628.0, "Ixe_50_in4": 9.141, "Sxe_50_in3": 1.132, "Ma_50_inkip": 33.89, "Vag_50_lb": 1628.0, "Jx1000_in4": 0.906, "Cw_in6": 8.125, "Xo_in": -1.142, "m_in": 0.734, "Ro_in": 3.99, "beta_in": 0.918},
    "1000T250-68": {"thickness_in": 0.0713, "area_in2": 1.068, "weight_lbft": 3.64, "Ix_in4": 15.138, "Sx_in3": 2.954, "Rx_in": 3.764, "Iy_in4": 0.536, "Ry_in": 0.708, "Ixe_33_in4": 13.578, "Sxe_33_in3": 1.997, "Ma_33_inkip": 39.46, "Vag_33_lb": 3261.0, "Ixe_50_in4": 12.708, "Sxe_50_in3": 1.726, "Ma_50_inkip": 51.68, "Vag_50_lb": 3261.0, "Jx1000_in4": 1.811, "Cw_in6": 10.24, "Xo_in": -1.135, "m_in": 0.73, "Ro_in": 3.995, "beta_in": 0.919},
    "1000T250-97": {"thickness_in": 0.1017, "area_in2": 1.523, "weight_lbft": 5.18, "Ix_in4": 21.76, "Sx_in3": 4.203, "Rx_in": 3.78, "Iy_in4": 0.751, "Ry_in": 0.702, "Ixe_33_in4": 20.871, "Sxe_33_in3": 3.596, "Ma_33_inkip": 71.05, "Vag_33_lb": 8843.0, "Ixe_50_in4": 20.254, "Sxe_50_in3": 3.201, "Ma_50_inkip": 95.84, "Vag_50_lb": 9507.0, "Jx1000_in4": 5.252, "Cw_in6": 14.617, "Xo_in": -1.122, "m_in": 0.721, "Ro_in": 4.005, "beta_in": 0.921},
    "1000T250-118": {"thickness_in": 0.1242, "area_in2": 1.86, "weight_lbft": 6.33, "Ix_in4": 26.723, "Sx_in3": 5.122, "Rx_in": 3.791, "Iy_in4": 0.905, "Ry_in": 0.698, "Ixe_33_in4": 26.538, "Sxe_33_in3": 4.721, "Ma_33_inkip": 93.29, "Vag_33_lb": 13189.0, "Ixe_50_in4": 25.721, "Sxe_50_in3": 4.422, "Ma_50_inkip": 132.38, "Vag_50_lb": 16235.0, "Jx1000_in4": 9.562, "Cw_in6": 17.858, "Xo_in": -1.112, "m_in": 0.715, "Ro_in": 4.012, "beta_in": 0.923},
    "1200T125-54": {"thickness_in": 0.0566, "area_in2": 0.82, "weight_lbft": 2.79, "Ix_in4": 13.335, "Sx_in3": 2.186, "Rx_in": 4.033, "Iy_in4": 0.06, "Ry_in": 0.271, "Ixe_33_in4": 12.296, "Sxe_33_in3": 1.491, "Ma_33_inkip": 29.47, "Vag_33_lb": 1354.0, "Ixe_50_in4": 11.46, "Sxe_50_in3": 1.286, "Ma_50_inkip": 38.51, "Vag_50_lb": 1354.0, "Jx1000_in4": 0.876, "Cw_in6": 1.82, "Xo_in": -0.333, "m_in": 0.23, "Ro_in": 4.055, "beta_in": 0.993},
    "1200T125-68": {"thickness_in": 0.0713, "area_in2": 1.033, "weight_lbft": 3.51, "Ix_in4": 16.826, "Sx_in3": 2.747, "Rx_in": 4.036, "Iy_in4": 0.074, "Ry_in": 0.268, "Ixe_33_in4": 16.246, "Sxe_33_in3": 2.206, "Ma_33_inkip": 43.6, "Vag_33_lb": 2713.0, "Ixe_50_in4": 15.686, "Sxe_50_in3": 1.934, "Ma_50_inkip": 57.9, "Vag_50_lb": 2713.0, "Jx1000_in4": 1.75, "Cw_in6": 2.27, "Xo_in": -0.329, "m_in": 0.227, "Ro_in": 4.059, "beta_in": 0.993},
    "1200T125-97": {"thickness_in": 0.1017, "area_in2": 1.472, "weight_lbft": 5.01, "Ix_in4": 24.078, "Sx_in3": 3.897, "Rx_in": 4.044, "Iy_in4": 0.102, "Ry_in": 0.263, "Ixe_33_in4": 24.078, "Sxe_33_in3": 3.69, "Ma_33_inkip": 72.92, "Vag_33_lb": 7902.0, "Ixe_50_in4": 23.751, "Sxe_50_in3": 3.442, "Ma_50_inkip": 103.06, "Vag_50_lb": 7902.0, "Jx1000_in4": 5.076, "Cw_in6": 3.171, "Xo_in": -0.322, "m_in": 0.222, "Ro_in": 4.065, "beta_in": 0.994},
    "1200T125-118": {"thickness_in": 0.1242, "area_in2": 1.798, "weight_lbft": 6.12, "Ix_in4": 29.472, "Sx_in3": 4.74, "Rx_in": 4.049, "Iy_in4": 0.121, "Ry_in": 0.26, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 29.472, "Sxe_50_in3": 4.49, "Ma_50_inkip": 134.44, "Vag_50_lb": 14434.0, "Jx1000_in4": 9.243, "Cw_in6": 3.812, "Xo_in": -0.316, "m_in": 0.218, "Ro_in": 4.07, "beta_in": 0.994},
    "1200T150-54": {"thickness_in": 0.0566, "area_in2": 0.848, "weight_lbft": 2.89, "Ix_in4": 14.378, "Sx_in3": 2.357, "Rx_in": 4.117, "Iy_in4": 0.103, "Ry_in": 0.348, "Ixe_33_in4": 12.962, "Sxe_33_in3": 1.53, "Ma_33_inkip": 30.23, "Vag_33_lb": 1354.0, "Ixe_50_in4": 12.02, "Sxe_50_in3": 1.313, "Ma_50_inkip": 39.31, "Vag_50_lb": 1354.0, "Jx1000_in4": 0.906, "Cw_in6": 3.033, "Xo_in": -0.454, "m_in": 0.31, "Ro_in": 4.156, "beta_in": 0.988},
    "1200T150-68": {"thickness_in": 0.0713, "area_in2": 1.068, "weight_lbft": 3.64, "Ix_in4": 18.148, "Sx_in3": 2.963, "Rx_in": 4.121, "Iy_in4": 0.127, "Ry_in": 0.345, "Ixe_33_in4": 17.568, "Sxe_33_in3": 2.281, "Ma_33_inkip": 45.08, "Vag_33_lb": 2713.0, "Ixe_50_in4": 16.566, "Sxe_50_in3": 1.987, "Ma_50_inkip": 59.48, "Vag_50_lb": 2713.0, "Jx1000_in4": 1.81, "Cw_in6": 3.795, "Xo_in": -0.45, "m_in": 0.307, "Ro_in": 4.16, "beta_in": 0.988},
    "1200T150-97": {"thickness_in": 0.1017, "area_in2": 1.523, "weight_lbft": 5.18, "Ix_in4": 25.987, "Sx_in3": 4.206, "Rx_in": 4.13, "Iy_in4": 0.176, "Ry_in": 0.34, "Ixe_33_in4": 25.987, "Sxe_33_in3": 3.996, "Ma_33_inkip": 78.97, "Vag_33_lb": 7902.0, "Ixe_50_in4": 25.719, "Sxe_50_in3": 3.616, "Ma_50_inkip": 108.27, "Vag_50_lb": 7902.0, "Jx1000_in4": 5.252, "Cw_in6": 5.335, "Xo_in": -0.441, "m_in": 0.301, "Ro_in": 4.168, "beta_in": 0.989},
    "1200T150-118": {"thickness_in": 0.1242, "area_in2": 1.86, "weight_lbft": 6.33, "Ix_in4": 31.825, "Sx_in3": 5.119, "Rx_in": 4.137, "Iy_in4": 0.21, "Ry_in": 0.336, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 31.825, "Sxe_50_in3": 4.865, "Ma_50_inkip": 145.66, "Vag_50_lb": 14434.0, "Jx1000_in4": 9.562, "Cw_in6": 6.444, "Xo_in": -0.435, "m_in": 0.296, "Ro_in": 4.173, "beta_in": 0.989},
    "1200T200-54": {"thickness_in": 0.0566, "area_in2": 0.905, "weight_lbft": 3.08, "Ix_in4": 16.464, "Sx_in3": 2.699, "Rx_in": 4.265, "Iy_in4": 0.236, "Ry_in": 0.51, "Ixe_33_in4": 14.078, "Sxe_33_in3": 1.582, "Ma_33_inkip": 31.26, "Vag_33_lb": 1354.0, "Ixe_50_in4": 12.962, "Sxe_50_in3": 1.35, "Ma_50_inkip": 40.41, "Vag_50_lb": 1354.0, "Jx1000_in4": 0.966, "Cw_in6": 6.714, "Xo_in": -0.73, "m_in": 0.487, "Ro_in": 4.357, "beta_in": 0.972},
    "1200T200-68": {"thickness_in": 0.0713, "area_in2": 1.14, "weight_lbft": 3.88, "Ix_in4": 20.791, "Sx_in3": 3.395, "Rx_in": 4.271, "Iy_in4": 0.294, "Ry_in": 0.508, "Ixe_33_in4": 19.277, "Sxe_33_in3": 2.383, "Ma_33_inkip": 47.09, "Vag_33_lb": 2713.0, "Ixe_50_in4": 18.026, "Sxe_50_in3": 2.058, "Ma_50_inkip": 61.62, "Vag_50_lb": 2713.0, "Jx1000_in4": 1.931, "Cw_in6": 8.431, "Xo_in": -0.725, "m_in": 0.483, "Ro_in": 4.362, "beta_in": 0.972},
    "1200T200-97": {"thickness_in": 0.1017, "area_in2": 1.625, "weight_lbft": 5.53, "Ix_in4": 29.805, "Sx_in3": 4.824, "Rx_in": 4.283, "Iy_in4": 0.41, "Ry_in": 0.502, "Ixe_33_in4": 29.805, "Sxe_33_in3": 4.298, "Ma_33_inkip": 84.93, "Vag_33_lb": 7902.0, "Ixe_50_in4": 28.959, "Sxe_50_in3": 3.819, "Ma_50_inkip": 114.35, "Vag_50_lb": 7902.0, "Jx1000_in4": 5.602, "Cw_in6": 11.945, "Xo_in": -0.714, "m_in": 0.476, "Ro_in": 4.371, "beta_in": 0.973},
    "1200T200-118": {"thickness_in": 0.1242, "area_in2": 1.984, "weight_lbft": 6.75, "Ix_in4": 36.53, "Sx_in3": 5.876, "Rx_in": 4.291, "Iy_in4": 0.492, "Ry_in": 0.498, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 36.53, "Sxe_50_in3": 5.278, "Ma_50_inkip": 158.02, "Vag_50_lb": 14434.0, "Jx1000_in4": 10.201, "Cw_in6": 14.513, "Xo_in": -0.706, "m_in": 0.471, "Ro_in": 4.377, "beta_in": 0.974},
    "1200T250-54": {"thickness_in": 0.0566, "area_in2": 0.962, "weight_lbft": 3.27, "Ix_in4": 18.55, "Sx_in3": 3.041, "Rx_in": 4.392, "Iy_in4": 0.445, "Ry_in": 0.681, "Ixe_33_in4": 15.021, "Sxe_33_in3": 1.617, "Ma_33_inkip": 31.95, "Vag_33_lb": 1354.0, "Ixe_50_in4": 13.756, "Sxe_50_in3": 1.374, "Ma_50_inkip": 41.14, "Vag_50_lb": 1354.0, "Jx1000_in4": 1.027, "Cw_in6": 12.339, "Xo_in": -1.039, "m_in": 0.68, "Ro_in": 4.565, "beta_in": 0.948},
    "1200T250-68": {"thickness_in": 0.0713, "area_in2": 1.211, "weight_lbft": 4.12, "Ix_in4": 23.435, "Sx_in3": 3.826, "Rx_in": 4.399, "Iy_in4": 0.556, "Ry_in": 0.678, "Ixe_33_in4": 20.72, "Sxe_33_in3": 2.451, "Ma_33_inkip": 48.44, "Vag_33_lb": 2713.0, "Ixe_50_in4": 19.255, "Sxe_50_in3": 2.106, "Ma_50_inkip": 63.04, "Vag_50_lb": 2713.0, "Jx1000_in4": 2.052, "Cw_in6": 15.529, "Xo_in": -1.033, "m_in": 0.676, "Ro_in": 4.569, "beta_in": 0.949},
    "1200T250-97": {"thickness_in": 0.1017, "area_in2": 1.727, "weight_lbft": 5.88, "Ix_in4": 33.623, "Sx_in3": 5.442, "Rx_in": 4.413, "Iy_in4": 0.78, "Ry_in": 0.672, "Ixe_33_in4": 32.479, "Sxe_33_in3": 4.489, "Ma_33_inkip": 88.7, "Vag_33_lb": 7902.0, "Ixe_50_in4": 31.31, "Sxe_50_in3": 3.954, "Ma_50_inkip": 118.37, "Vag_50_lb": 7902.0, "Jx1000_in4": 5.953, "Cw_in6": 22.101, "Xo_in": -1.021, "m_in": 0.668, "Ro_in": 4.579, "beta_in": 0.95},
    "1200T250-118": {"thickness_in": 0.1242, "area_in2": 2.108, "weight_lbft": 7.17, "Ix_in4": 41.236, "Sx_in3": 6.632, "Rx_in": 4.423, "Iy_in4": 0.94, "Ry_in": 0.668, "Ixe_33_in4": 40.963, "Sxe_33_in3": 6.138, "Ma_33_inkip": 121.28, "Vag_33_lb": 13189.0, "Ixe_50_in4": 39.954, "Sxe_50_in3": 5.519, "Ma_50_inkip": 165.24, "Vag_50_lb": 14434.0, "Jx1000_in4": 10.839, "Cw_in6": 26.943, "Xo_in": -1.013, "m_in": 0.662, "Ro_in": 4.586, "beta_in": 0.951},
    "1400T125-54": {"thickness_in": 0.0566, "area_in2": 0.933, "weight_lbft": 3.18, "Ix_in4": 19.977, "Sx_in3": 2.814, "Rx_in": 4.627, "Iy_in4": 0.061, "Ry_in": 0.256, "Ixe_33_in4": 17.725, "Sxe_33_in3": 1.767, "Ma_33_inkip": 34.91, "Vag_33_lb": 1160.0, "Ixe_50_in4": 16.407, "Sxe_50_in3": 1.517, "Ma_50_inkip": 45.42, "Vag_50_lb": 1160.0, "Jx1000_in4": 0.997, "Cw_in6": 2.559, "Xo_in": -0.299, "m_in": 0.209, "Ro_in": 4.643, "beta_in": 0.996},
    "1400T125-68": {"thickness_in": 0.0713, "area_in2": 1.175, "weight_lbft": 4.0, "Ix_in4": 25.196, "Sx_in3": 3.536, "Rx_in": 4.63, "Iy_in4": 0.076, "Ry_in": 0.254, "Ixe_33_in4": 23.552, "Sxe_33_in3": 2.632, "Ma_33_inkip": 52.01, "Vag_33_lb": 2322.0, "Ixe_50_in4": 22.62, "Sxe_50_in3": 2.293, "Ma_50_inkip": 68.64, "Vag_50_lb": 2322.0, "Jx1000_in4": 1.992, "Cw_in6": 3.189, "Xo_in": -0.296, "m_in": 0.206, "Ro_in": 4.646, "beta_in": 0.996},
    "1400T125-97": {"thickness_in": 0.1017, "area_in2": 1.676, "weight_lbft": 5.7, "Ix_in4": 36.024, "Sx_in3": 5.019, "Rx_in": 4.636, "Iy_in4": 0.104, "Ry_in": 0.249, "Ixe_33_in4": 35.775, "Sxe_33_in3": 4.48, "Ma_33_inkip": 88.53, "Vag_33_lb": 6761.0, "Ixe_50_in4": 34.588, "Sxe_50_in3": 4.134, "Ma_50_inkip": 123.76, "Vag_50_lb": 6761.0, "Jx1000_in4": 5.778, "Cw_in6": 4.445, "Xo_in": -0.289, "m_in": 0.201, "Ro_in": 4.652, "beta_in": 0.996},
    "1400T125-118": {"thickness_in": 0.1242, "area_in2": 2.046, "weight_lbft": 6.96, "Ix_in4": 44.068, "Sx_in3": 6.106, "Rx_in": 4.641, "Iy_in4": 0.123, "Ry_in": 0.245, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 43.752, "Sxe_50_in3": 5.453, "Ma_50_inkip": 163.27, "Vag_50_lb": 12344.0, "Jx1000_in4": 10.52, "Cw_in6": 5.334, "Xo_in": -0.284, "m_in": 0.197, "Ro_in": 4.656, "beta_in": 0.996},
    "1400T150-54": {"thickness_in": 0.0566, "area_in2": 0.962, "weight_lbft": 3.27, "Ix_in4": 21.392, "Sx_in3": 3.013, "Rx_in": 4.717, "Iy_in4": 0.105, "Ry_in": 0.33, "Ixe_33_in4": 18.62, "Sxe_33_in3": 1.81, "Ma_33_inkip": 35.76, "Vag_33_lb": 1160.0, "Ixe_50_in4": 17.153, "Sxe_50_in3": 1.547, "Ma_50_inkip": 46.33, "Vag_50_lb": 1160.0, "Jx1000_in4": 1.027, "Cw_in6": 4.28, "Xo_in": -0.41, "m_in": 0.283, "Ro_in": 4.746, "beta_in": 0.993},
    "1400T150-68": {"thickness_in": 0.0713, "area_in2": 1.211, "weight_lbft": 4.12, "Ix_in4": 26.987, "Sx_in3": 3.788, "Rx_in": 4.721, "Iy_in4": 0.13, "Ry_in": 0.327, "Ixe_33_in4": 25.409, "Sxe_33_in3": 2.717, "Ma_33_inkip": 53.68, "Vag_33_lb": 2322.0, "Ixe_50_in4": 23.803, "Sxe_50_in3": 2.352, "Ma_50_inkip": 70.42, "Vag_50_lb": 2322.0, "Jx1000_in4": 2.052, "Cw_in6": 5.349, "Xo_in": -0.407, "m_in": 0.28, "Ro_in": 4.749, "beta_in": 0.993},
    "1400T150-97": {"thickness_in": 0.1017, "area_in2": 1.727, "weight_lbft": 5.88, "Ix_in4": 38.607, "Sx_in3": 5.379, "Rx_in": 4.729, "Iy_in4": 0.18, "Ry_in": 0.322, "Ixe_33_in4": 38.34, "Sxe_33_in3": 4.834, "Ma_33_inkip": 95.52, "Vag_33_lb": 6761.0, "Ixe_50_in4": 37.285, "Sxe_50_in3": 4.332, "Ma_50_inkip": 129.69, "Vag_50_lb": 6761.0, "Jx1000_in4": 5.953, "Cw_in6": 7.503, "Xo_in": -0.399, "m_in": 0.275, "Ro_in": 4.756, "beta_in": 0.993},
    "1400T150-118": {"thickness_in": 0.1242, "area_in2": 2.108, "weight_lbft": 7.17, "Ix_in4": 47.247, "Sx_in3": 6.546, "Rx_in": 4.734, "Iy_in4": 0.214, "Ry_in": 0.319, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 46.911, "Sxe_50_in3": 5.887, "Ma_50_inkip": 176.24, "Vag_50_lb": 12344.0, "Jx1000_in4": 10.839, "Cw_in6": 9.048, "Xo_in": -0.393, "m_in": 0.27, "Ro_in": 4.761, "beta_in": 0.993},
    "1400T200-54": {"thickness_in": 0.0566, "area_in2": 1.018, "weight_lbft": 3.46, "Ix_in4": 24.221, "Sx_in3": 3.412, "Rx_in": 4.878, "Iy_in4": 0.242, "Ry_in": 0.487, "Ixe_33_in4": 20.098, "Sxe_33_in3": 1.868, "Ma_33_inkip": 36.92, "Vag_33_lb": 1160.0, "Ixe_50_in4": 18.387, "Sxe_50_in3": 1.589, "Ma_50_inkip": 47.56, "Vag_50_lb": 1160.0, "Jx1000_in4": 1.087, "Cw_in6": 9.52, "Xo_in": -0.665, "m_in": 0.449, "Ro_in": 4.947, "beta_in": 0.982},
    "1400T200-68": {"thickness_in": 0.0713, "area_in2": 1.282, "weight_lbft": 4.36, "Ix_in4": 30.571, "Sx_in3": 4.291, "Rx_in": 4.883, "Iy_in4": 0.301, "Ry_in": 0.485, "Ixe_33_in4": 27.707, "Sxe_33_in3": 2.83, "Ma_33_inkip": 55.93, "Vag_33_lb": 2322.0, "Ixe_50_in4": 25.738, "Sxe_50_in3": 2.432, "Ma_50_inkip": 72.81, "Vag_50_lb": 2322.0, "Jx1000_in4": 2.173, "Cw_in6": 11.942, "Xo_in": -0.661, "m_in": 0.446, "Ro_in": 4.951, "beta_in": 0.982},
    "1400T200-97": {"thickness_in": 0.1017, "area_in2": 1.828, "weight_lbft": 6.22, "Ix_in4": 43.773, "Sx_in3": 6.098, "Rx_in": 4.893, "Iy_in4": 0.42, "Ry_in": 0.479, "Ixe_33_in4": 43.679, "Sxe_33_in3": 5.174, "Ma_33_inkip": 102.24, "Vag_33_lb": 6761.0, "Ixe_50_in4": 41.749, "Sxe_50_in3": 4.559, "Ma_50_inkip": 136.48, "Vag_50_lb": 6761.0, "Jx1000_in4": 6.304, "Cw_in6": 16.883, "Xo_in": -0.651, "m_in": 0.439, "Ro_in": 4.959, "beta_in": 0.983},
    "1400T200-118": {"thickness_in": 0.1242, "area_in2": 2.232, "weight_lbft": 7.6, "Ix_in4": 53.606, "Sx_in3": 7.427, "Rx_in": 4.9, "Iy_in4": 0.504, "Ry_in": 0.475, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 53.453, "Sxe_50_in3": 6.354, "Ma_50_inkip": 190.23, "Vag_50_lb": 12344.0, "Jx1000_in4": 11.478, "Cw_in6": 20.479, "Xo_in": -0.644, "m_in": 0.434, "Ro_in": 4.965, "beta_in": 0.983},
    "1400T250-54": {"thickness_in": 0.0566, "area_in2": 1.075, "weight_lbft": 3.66, "Ix_in4": 27.051, "Sx_in3": 3.811, "Rx_in": 5.017, "Iy_in4": 0.458, "Ry_in": 0.653, "Ixe_33_in4": 21.342, "Sxe_33_in3": 1.907, "Ma_33_inkip": 37.68, "Vag_33_lb": 1160.0, "Ixe_50_in4": 19.421, "Sxe_50_in3": 1.616, "Ma_50_inkip": 48.38, "Vag_50_lb": 1160.0, "Jx1000_in4": 1.148, "Cw_in6": 17.55, "Xo_in": -0.954, "m_in": 0.633, "Ro_in": 5.149, "beta_in": 0.966},
    "1400T250-68": {"thickness_in": 0.0713, "area_in2": 1.354, "weight_lbft": 4.61, "Ix_in4": 34.154, "Sx_in3": 4.794, "Rx_in": 5.023, "Iy_in4": 0.573, "Ry_in": 0.651, "Ixe_33_in4": 29.615, "Sxe_33_in3": 2.906, "Ma_33_inkip": 57.42, "Vag_33_lb": 2322.0, "Ixe_50_in4": 27.352, "Sxe_50_in3": 2.485, "Ma_50_inkip": 74.4, "Vag_50_lb": 2322.0, "Jx1000_in4": 2.294, "Cw_in6": 22.063, "Xo_in": -0.949, "m_in": 0.629, "Ro_in": 5.153, "beta_in": 0.966},
    "1400T250-97": {"thickness_in": 0.1017, "area_in2": 1.93, "weight_lbft": 6.57, "Ix_in4": 48.939, "Sx_in3": 6.818, "Rx_in": 5.036, "Iy_in4": 0.803, "Ry_in": 0.645, "Ixe_33_in4": 47.449, "Sxe_33_in3": 5.386, "Ma_33_inkip": 106.42, "Vag_33_lb": 6761.0, "Ixe_50_in4": 44.883, "Sxe_50_in3": 4.708, "Ma_50_inkip": 140.94, "Vag_50_lb": 6761.0, "Jx1000_in4": 6.654, "Cw_in6": 31.333, "Xo_in": -0.938, "m_in": 0.622, "Ro_in": 5.163, "beta_in": 0.967},
    "1400T250-118": {"thickness_in": 0.1242, "area_in2": 2.357, "weight_lbft": 8.02, "Ix_in4": 59.965, "Sx_in3": 8.308, "Rx_in": 5.045, "Iy_in4": 0.967, "Ry_in": 0.641, "Ixe_33_in4": 59.734, "Sxe_33_in3": 7.439, "Ma_33_inkip": 146.99, "Vag_33_lb": 12344.0, "Ixe_50_in4": 58.277, "Sxe_50_in3": 6.622, "Ma_50_inkip": 198.25, "Vag_50_lb": 12344.0, "Jx1000_in4": 12.117, "Cw_in6": 38.137, "Xo_in": -0.93, "m_in": 0.616, "Ro_in": 5.169, "beta_in": 0.968},
    "1600T125-68": {"thickness_in": 0.0713, "area_in2": 1.318, "weight_lbft": 4.48, "Ix_in4": 35.916, "Sx_in3": 4.421, "Rx_in": 5.22, "Iy_in4": 0.077, "Ry_in": 0.241, "Ixe_33_in4": 32.443, "Sxe_33_in3": 3.058, "Ma_33_inkip": 60.42, "Vag_33_lb": 2030.0, "Ixe_50_in4": 31.004, "Sxe_50_in3": 2.651, "Ma_50_inkip": 79.37, "Vag_50_lb": 2030.0, "Jx1000_in4": 2.233, "Cw_in6": 4.273, "Xo_in": -0.268, "m_in": 0.189, "Ro_in": 5.233, "beta_in": 0.997},
    "1600T125-97": {"thickness_in": 0.1017, "area_in2": 1.879, "weight_lbft": 6.39, "Ix_in4": 51.322, "Sx_in3": 6.276, "Rx_in": 5.226, "Iy_in4": 0.105, "Ry_in": 0.237, "Ixe_33_in4": 49.844, "Sxe_33_in3": 5.273, "Ma_33_inkip": 104.19, "Vag_33_lb": 5908.0, "Ixe_50_in4": 47.83, "Sxe_50_in3": 4.825, "Ma_50_inkip": 144.47, "Vag_50_lb": 5908.0, "Jx1000_in4": 6.479, "Cw_in6": 5.945, "Xo_in": -0.262, "m_in": 0.184, "Ro_in": 5.238, "beta_in": 0.997},
    "1600T125-118": {"thickness_in": 0.1242, "area_in2": 2.294, "weight_lbft": 7.81, "Ix_in4": 62.755, "Sx_in3": 7.637, "Rx_in": 5.23, "Iy_in4": 0.125, "Ry_in": 0.233, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 60.93, "Sxe_50_in3": 6.42, "Ma_50_inkip": 192.21, "Vag_50_lb": 10783.0, "Jx1000_in4": 11.797, "Cw_in6": 7.126, "Xo_in": -0.257, "m_in": 0.181, "Ro_in": 5.241, "beta_in": 0.998},
    "1600T150-68": {"thickness_in": 0.0713, "area_in2": 1.354, "weight_lbft": 4.61, "Ix_in4": 38.249, "Sx_in3": 4.708, "Rx_in": 5.316, "Iy_in4": 0.132, "Ry_in": 0.312, "Ixe_33_in4": 34.945, "Sxe_33_in3": 3.152, "Ma_33_inkip": 62.28, "Vag_33_lb": 2030.0, "Ixe_50_in4": 32.537, "Sxe_50_in3": 2.717, "Ma_50_inkip": 81.34, "Vag_50_lb": 2030.0, "Jx1000_in4": 2.294, "Cw_in6": 7.188, "Xo_in": -0.371, "m_in": 0.258, "Ro_in": 5.338, "beta_in": 0.995},
    "1600T150-97": {"thickness_in": 0.1242, "area_in2": 2.357, "weight_lbft": 8.02, "Ix_in4": 66.886, "Sx_in3": 8.14, "Rx_in": 5.328, "Iy_in4": 0.218, "Ry_in": 0.304, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 65.023, "Sxe_50_in3": 6.911, "Ma_50_inkip": 206.91, "Vag_50_lb": 10783.0, "Jx1000_in4": 12.117, "Cw_in6": 12.124, "Xo_in": -0.358, "m_in": 0.249, "Ro_in": 5.348, "beta_in": 0.996},
    "1600T200-68": {"thickness_in": 0.0713, "area_in2": 1.425, "weight_lbft": 4.85, "Ix_in4": 42.914, "Sx_in3": 5.282, "Rx_in": 5.488, "Iy_in4": 0.307, "Ry_in": 0.464, "Ixe_33_in4": 37.904, "Sxe_33_in3": 3.277, "Ma_33_inkip": 64.76, "Vag_33_lb": 2030.0, "Ixe_50_in4": 35.009, "Sxe_50_in3": 2.805, "Ma_50_inkip": 83.99, "Vag_50_lb": 2030.0, "Jx1000_in4": 2.415, "Cw_in6": 16.123, "Xo_in": -0.607, "m_in": 0.414, "Ro_in": 5.541, "beta_in": 0.988},
    "1600T200-97": {"thickness_in": 0.1017, "area_in2": 2.032, "weight_lbft": 6.91, "Ix_in4": 61.398, "Sx_in3": 7.508, "Rx_in": 5.497, "Iy_in4": 0.428, "Ry_in": 0.459, "Ixe_33_in4": 60.199, "Sxe_33_in3": 6.052, "Ma_33_inkip": 119.6, "Vag_33_lb": 5908.0, "Ixe_50_in4": 57.292, "Sxe_50_in3": 5.298, "Ma_50_inkip": 158.62, "Vag_50_lb": 5908.0, "Jx1000_in4": 7.005, "Cw_in6": 22.755, "Xo_in": -0.598, "m_in": 0.408, "Ro_in": 5.549, "beta_in": 0.988},
    "1600T200-118": {"thickness_in": 0.1242, "area_in2": 2.481, "weight_lbft": 8.44, "Ix_in4": 75.146, "Sx_in3": 9.145, "Rx_in": 5.504, "Iy_in4": 0.514, "Ry_in": 0.455, "Ixe_33_in4": null, "Sxe_33_in3": null, "Ma_33_inkip": null, "Vag_33_lb": null, "Ixe_50_in4": 73.613, "Sxe_50_in3": 7.433, "Ma_50_inkip": 222.53, "Vag_50_lb": 10783.0, "Jx1000_in4": 12.755, "Cw_in6": 27.568, "Xo_in": -0.592, "m_in": 0.403, "Ro_in": 5.554, "beta_in": 0.989},
    "1600T250-68": {"thickness_in": 0.0713, "area_in2": 1.496, "weight_lbft": 5.09, "Ix_in4": 47.58, "Sx_in3": 5.856, "Rx_in": 5.639, "Iy_in4": 0.586, "Ry_in": 0.626, "Ixe_33_in4": 40.337, "Sxe_33_in3": 3.36, "Ma_33_inkip": 66.4, "Vag_33_lb": 2030.0, "Ixe_50_in4": 37.06, "Sxe_50_in3": 2.864, "Ma_50_inkip": 85.75, "Vag_50_lb": 2030.0, "Jx1000_in4": 2.535, "Cw_in6": 29.878, "Xo_in": -0.878, "m_in": 0.588, "Ro_in": 5.741, "beta_in": 0.977},
    "1600T250-97": {"thickness_in": 0.1017, "area_in2": 2.134, "weight_lbft": 7.26, "Ix_in4": 68.116, "Sx_in3": 8.329, "Rx_in": 5.65, "Iy_in4": 0.821, "Ry_in": 0.62, "Ixe_33_in4": 65.163, "Sxe_33_in3": 6.285, "Ma_33_inkip": 124.19, "Vag_33_lb": 5908.0, "Ixe_50_in4": 61.325, "Sxe_50_in3": 5.461, "Ma_50_inkip": 163.51, "Vag_50_lb": 5908.0, "Jx1000_in4": 7.355, "Cw_in6": 42.361, "Xo_in": -0.868, "m_in": 0.581, "Ro_in": 5.75, "beta_in": 0.977},
    "1600T250-118": {"thickness_in": 0.1242, "area_in2": 2.605, "weight_lbft": 8.86, "Ix_in4": 83.406, "Sx_in3": 10.15, "Rx_in": 5.659, "Iy_in4": 0.989, "Ry_in": 0.616, "Ixe_33_in4": 83.311, "Sxe_33_in3": 8.747, "Ma_33_inkip": 172.84, "Vag_33_lb": 10783.0, "Ixe_50_in4": 79.965, "Sxe_50_in3": 7.727, "Ma_50_inkip": 231.83, "Vag_50_lb": 10783.0, "Jx1000_in4": 13.394, "Cw_in6": 51.497, "Xo_in": -0.86, "m_in": 0.576, "Ro_in": 5.757, "beta_in": 0.978}
  };

  // ================================================================
  // DROPDOWN LISTS
  // ================================================================

  var studSections = [
    {
        "value": "162S125-18",
        "label": "162S125-18  (1.62in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "162S125-27",
        "label": "162S125-27  (1.62in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "162S125-30",
        "label": "162S125-30  (1.62in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "162S125-33",
        "label": "162S125-33  (1.62in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "250S125-18",
        "label": "250S125-18  (2.5in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "250S125-27",
        "label": "250S125-27  (2.5in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "250S125-30",
        "label": "250S125-30  (2.5in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "250S125-33",
        "label": "250S125-33  (2.5in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "250S125-43",
        "label": "250S125-43  (2.5in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "250S125-54",
        "label": "250S125-54  (2.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "250S125-68",
        "label": "250S125-68  (2.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "250S137-33",
        "label": "250S137-33  (2.5in web, 1.37in flange, 33 mil)"
    },
    {
        "value": "250S137-43",
        "label": "250S137-43  (2.5in web, 1.37in flange, 43 mil)"
    },
    {
        "value": "250S137-54",
        "label": "250S137-54  (2.5in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "250S137-68",
        "label": "250S137-68  (2.5in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "250S137-97",
        "label": "250S137-97  (2.5in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "250S162-33",
        "label": "250S162-33  (2.5in web, 1.62in flange, 33 mil)"
    },
    {
        "value": "250S162-43",
        "label": "250S162-43  (2.5in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "250S162-54",
        "label": "250S162-54  (2.5in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "250S162-68",
        "label": "250S162-68  (2.5in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "250S162-97",
        "label": "250S162-97  (2.5in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "250S200-33",
        "label": "250S200-33  (2.5in web, 2in flange, 33 mil)"
    },
    {
        "value": "250S200-43",
        "label": "250S200-43  (2.5in web, 2in flange, 43 mil)"
    },
    {
        "value": "250S200-54",
        "label": "250S200-54  (2.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "250S200-68",
        "label": "250S200-68  (2.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "250S200-97",
        "label": "250S200-97  (2.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "250S250-43",
        "label": "250S250-43  (2.5in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "250S250-54",
        "label": "250S250-54  (2.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "250S250-68",
        "label": "250S250-68  (2.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "250S250-97",
        "label": "250S250-97  (2.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "350S125-18",
        "label": "350S125-18  (3.5in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "350S125-27",
        "label": "350S125-27  (3.5in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "350S125-30",
        "label": "350S125-30  (3.5in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "350S125-33",
        "label": "350S125-33  (3.5in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "350S125-43",
        "label": "350S125-43  (3.5in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "350S125-54",
        "label": "350S125-54  (3.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "350S125-68",
        "label": "350S125-68  (3.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "350S137-33",
        "label": "350S137-33  (3.5in web, 1.37in flange, 33 mil)"
    },
    {
        "value": "350S137-43",
        "label": "350S137-43  (3.5in web, 1.37in flange, 43 mil)"
    },
    {
        "value": "350S137-54",
        "label": "350S137-54  (3.5in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "350S137-68",
        "label": "350S137-68  (3.5in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "350S137-97",
        "label": "350S137-97  (3.5in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "350S162-33",
        "label": "350S162-33  (3.5in web, 1.62in flange, 33 mil)"
    },
    {
        "value": "350S162-43",
        "label": "350S162-43  (3.5in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "350S162-54",
        "label": "350S162-54  (3.5in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "350S162-68",
        "label": "350S162-68  (3.5in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "350S162-97",
        "label": "350S162-97  (3.5in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "350S200-33",
        "label": "350S200-33  (3.5in web, 2in flange, 33 mil)"
    },
    {
        "value": "350S200-43",
        "label": "350S200-43  (3.5in web, 2in flange, 43 mil)"
    },
    {
        "value": "350S200-54",
        "label": "350S200-54  (3.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "350S200-68",
        "label": "350S200-68  (3.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "350S200-97",
        "label": "350S200-97  (3.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "350S250-43",
        "label": "350S250-43  (3.5in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "350S250-54",
        "label": "350S250-54  (3.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "350S250-68",
        "label": "350S250-68  (3.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "350S250-97",
        "label": "350S250-97  (3.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "362S125-18",
        "label": "362S125-18  (3.62in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "362S125-27",
        "label": "362S125-27  (3.62in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "362S125-30",
        "label": "362S125-30  (3.62in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "362S125-33",
        "label": "362S125-33  (3.62in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "362S125-43",
        "label": "362S125-43  (3.62in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "362S125-54",
        "label": "362S125-54  (3.62in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "362S125-68",
        "label": "362S125-68  (3.62in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "362S137-33",
        "label": "362S137-33  (3.62in web, 1.37in flange, 33 mil)"
    },
    {
        "value": "362S137-43",
        "label": "362S137-43  (3.62in web, 1.37in flange, 43 mil)"
    },
    {
        "value": "362S137-54",
        "label": "362S137-54  (3.62in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "362S137-68",
        "label": "362S137-68  (3.62in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "362S137-97",
        "label": "362S137-97  (3.62in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "362S162-33",
        "label": "362S162-33  (3.62in web, 1.62in flange, 33 mil)"
    },
    {
        "value": "362S162-43",
        "label": "362S162-43  (3.62in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "362S162-54",
        "label": "362S162-54  (3.62in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "362S162-68",
        "label": "362S162-68  (3.62in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "362S162-97",
        "label": "362S162-97  (3.62in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "362S200-33",
        "label": "362S200-33  (3.62in web, 2in flange, 33 mil)"
    },
    {
        "value": "362S200-43",
        "label": "362S200-43  (3.62in web, 2in flange, 43 mil)"
    },
    {
        "value": "362S200-54",
        "label": "362S200-54  (3.62in web, 2in flange, 54 mil)"
    },
    {
        "value": "362S200-68",
        "label": "362S200-68  (3.62in web, 2in flange, 68 mil)"
    },
    {
        "value": "362S200-97",
        "label": "362S200-97  (3.62in web, 2in flange, 97 mil)"
    },
    {
        "value": "362S250-43",
        "label": "362S250-43  (3.62in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "362S250-54",
        "label": "362S250-54  (3.62in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "362S250-68",
        "label": "362S250-68  (3.62in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "362S250-97",
        "label": "362S250-97  (3.62in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "362S300-54",
        "label": "362S300-54  (3.62in web, 3in flange, 54 mil)"
    },
    {
        "value": "362S300-68",
        "label": "362S300-68  (3.62in web, 3in flange, 68 mil)"
    },
    {
        "value": "362S300-97",
        "label": "362S300-97  (3.62in web, 3in flange, 97 mil)"
    },
    {
        "value": "400S125-18",
        "label": "400S125-18  (4in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "400S125-27",
        "label": "400S125-27  (4in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "400S125-30",
        "label": "400S125-30  (4in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "400S125-33",
        "label": "400S125-33  (4in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "400S125-43",
        "label": "400S125-43  (4in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "400S125-54",
        "label": "400S125-54  (4in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "400S125-68",
        "label": "400S125-68  (4in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "400S137-33",
        "label": "400S137-33  (4in web, 1.37in flange, 33 mil)"
    },
    {
        "value": "400S137-43",
        "label": "400S137-43  (4in web, 1.37in flange, 43 mil)"
    },
    {
        "value": "400S137-54",
        "label": "400S137-54  (4in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "400S137-68",
        "label": "400S137-68  (4in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "400S137-97",
        "label": "400S137-97  (4in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "400S162-33",
        "label": "400S162-33  (4in web, 1.62in flange, 33 mil)"
    },
    {
        "value": "400S162-43",
        "label": "400S162-43  (4in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "400S162-54",
        "label": "400S162-54  (4in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "400S162-68",
        "label": "400S162-68  (4in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "400S162-97",
        "label": "400S162-97  (4in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "400S200-33",
        "label": "400S200-33  (4in web, 2in flange, 33 mil)"
    },
    {
        "value": "400S200-43",
        "label": "400S200-43  (4in web, 2in flange, 43 mil)"
    },
    {
        "value": "400S200-54",
        "label": "400S200-54  (4in web, 2in flange, 54 mil)"
    },
    {
        "value": "400S200-68",
        "label": "400S200-68  (4in web, 2in flange, 68 mil)"
    },
    {
        "value": "400S200-97",
        "label": "400S200-97  (4in web, 2in flange, 97 mil)"
    },
    {
        "value": "400S250-43",
        "label": "400S250-43  (4in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "400S250-54",
        "label": "400S250-54  (4in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "400S250-68",
        "label": "400S250-68  (4in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "400S250-97",
        "label": "400S250-97  (4in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "400S300-54",
        "label": "400S300-54  (4in web, 3in flange, 54 mil)"
    },
    {
        "value": "400S300-68",
        "label": "400S300-68  (4in web, 3in flange, 68 mil)"
    },
    {
        "value": "400S300-97",
        "label": "400S300-97  (4in web, 3in flange, 97 mil)"
    },
    {
        "value": "550S125-27",
        "label": "550S125-27  (5.5in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "550S125-30",
        "label": "550S125-30  (5.5in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "550S125-33",
        "label": "550S125-33  (5.5in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "550S125-43",
        "label": "550S125-43  (5.5in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "550S125-54",
        "label": "550S125-54  (5.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "550S125-68",
        "label": "550S125-68  (5.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "550S137-33",
        "label": "550S137-33  (5.5in web, 1.37in flange, 33 mil)"
    },
    {
        "value": "550S137-43",
        "label": "550S137-43  (5.5in web, 1.37in flange, 43 mil)"
    },
    {
        "value": "550S137-54",
        "label": "550S137-54  (5.5in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "550S137-68",
        "label": "550S137-68  (5.5in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "550S137-97",
        "label": "550S137-97  (5.5in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "550S162-33",
        "label": "550S162-33  (5.5in web, 1.62in flange, 33 mil)"
    },
    {
        "value": "550S162-43",
        "label": "550S162-43  (5.5in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "550S162-54",
        "label": "550S162-54  (5.5in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "550S162-68",
        "label": "550S162-68  (5.5in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "550S162-97",
        "label": "550S162-97  (5.5in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "550S200-33",
        "label": "550S200-33  (5.5in web, 2in flange, 33 mil)"
    },
    {
        "value": "550S200-43",
        "label": "550S200-43  (5.5in web, 2in flange, 43 mil)"
    },
    {
        "value": "550S200-54",
        "label": "550S200-54  (5.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "550S200-68",
        "label": "550S200-68  (5.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "550S200-97",
        "label": "550S200-97  (5.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "550S250-43",
        "label": "550S250-43  (5.5in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "550S250-54",
        "label": "550S250-54  (5.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "550S250-68",
        "label": "550S250-68  (5.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "550S250-97",
        "label": "550S250-97  (5.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600S125-27",
        "label": "600S125-27  (6in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "600S125-30",
        "label": "600S125-30  (6in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "600S125-33",
        "label": "600S125-33  (6in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "600S125-43",
        "label": "600S125-43  (6in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "600S125-54",
        "label": "600S125-54  (6in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "600S125-68",
        "label": "600S125-68  (6in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "600S137-33",
        "label": "600S137-33  (6in web, 1.37in flange, 33 mil)"
    },
    {
        "value": "600S137-43",
        "label": "600S137-43  (6in web, 1.37in flange, 43 mil)"
    },
    {
        "value": "600S137-54",
        "label": "600S137-54  (6in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "600S137-68",
        "label": "600S137-68  (6in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "600S137-97",
        "label": "600S137-97  (6in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "600S137-118",
        "label": "600S137-118  (6in web, 1.37in flange, 118 mil)"
    },
    {
        "value": "600S162-33",
        "label": "600S162-33  (6in web, 1.62in flange, 33 mil)"
    },
    {
        "value": "600S162-43",
        "label": "600S162-43  (6in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "600S162-54",
        "label": "600S162-54  (6in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "600S162-68",
        "label": "600S162-68  (6in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "600S162-97",
        "label": "600S162-97  (6in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "600S162-118",
        "label": "600S162-118  (6in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "600S200-33",
        "label": "600S200-33  (6in web, 2in flange, 33 mil)"
    },
    {
        "value": "600S200-43",
        "label": "600S200-43  (6in web, 2in flange, 43 mil)"
    },
    {
        "value": "600S200-54",
        "label": "600S200-54  (6in web, 2in flange, 54 mil)"
    },
    {
        "value": "600S200-68",
        "label": "600S200-68  (6in web, 2in flange, 68 mil)"
    },
    {
        "value": "600S200-97",
        "label": "600S200-97  (6in web, 2in flange, 97 mil)"
    },
    {
        "value": "600S200-118",
        "label": "600S200-118  (6in web, 2in flange, 118 mil)"
    },
    {
        "value": "600S250-43",
        "label": "600S250-43  (6in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "600S250-54",
        "label": "600S250-54  (6in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "600S250-68",
        "label": "600S250-68  (6in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "600S250-97",
        "label": "600S250-97  (6in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600S250-118",
        "label": "600S250-118  (6in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "600S300-54",
        "label": "600S300-54  (6in web, 3in flange, 54 mil)"
    },
    {
        "value": "600S300-68",
        "label": "600S300-68  (6in web, 3in flange, 68 mil)"
    },
    {
        "value": "600S300-97",
        "label": "600S300-97  (6in web, 3in flange, 97 mil)"
    },
    {
        "value": "600S300-118",
        "label": "600S300-118  (6in web, 3in flange, 118 mil)"
    },
    {
        "value": "600S350-54",
        "label": "600S350-54  (6in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "600S350-68",
        "label": "600S350-68  (6in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "600S350-97",
        "label": "600S350-97  (6in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "600S350-118",
        "label": "600S350-118  (6in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "800S125-33",
        "label": "800S125-33  (8in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "800S125-43",
        "label": "800S125-43  (8in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "800S125-54",
        "label": "800S125-54  (8in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "800S125-68",
        "label": "800S125-68  (8in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "800S137-33",
        "label": "800S137-33  (8in web, 1.37in flange, 33 mil)"
    },
    {
        "value": "800S137-43",
        "label": "800S137-43  (8in web, 1.37in flange, 43 mil)"
    },
    {
        "value": "800S137-54",
        "label": "800S137-54  (8in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "800S137-68",
        "label": "800S137-68  (8in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "800S137-97",
        "label": "800S137-97  (8in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "800S137-118",
        "label": "800S137-118  (8in web, 1.37in flange, 118 mil)"
    },
    {
        "value": "800S162-33",
        "label": "800S162-33  (8in web, 1.62in flange, 33 mil)"
    },
    {
        "value": "800S162-43",
        "label": "800S162-43  (8in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "800S162-54",
        "label": "800S162-54  (8in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "800S162-68",
        "label": "800S162-68  (8in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "800S162-97",
        "label": "800S162-97  (8in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "800S162-118",
        "label": "800S162-118  (8in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "800S200-33",
        "label": "800S200-33  (8in web, 2in flange, 33 mil)"
    },
    {
        "value": "800S200-43",
        "label": "800S200-43  (8in web, 2in flange, 43 mil)"
    },
    {
        "value": "800S200-54",
        "label": "800S200-54  (8in web, 2in flange, 54 mil)"
    },
    {
        "value": "800S200-68",
        "label": "800S200-68  (8in web, 2in flange, 68 mil)"
    },
    {
        "value": "800S200-97",
        "label": "800S200-97  (8in web, 2in flange, 97 mil)"
    },
    {
        "value": "800S200-118",
        "label": "800S200-118  (8in web, 2in flange, 118 mil)"
    },
    {
        "value": "800S250-43",
        "label": "800S250-43  (8in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "800S250-54",
        "label": "800S250-54  (8in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "800S250-68",
        "label": "800S250-68  (8in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "800S250-97",
        "label": "800S250-97  (8in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "800S250-118",
        "label": "800S250-118  (8in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "800S300-54",
        "label": "800S300-54  (8in web, 3in flange, 54 mil)"
    },
    {
        "value": "800S300-68",
        "label": "800S300-68  (8in web, 3in flange, 68 mil)"
    },
    {
        "value": "800S300-97",
        "label": "800S300-97  (8in web, 3in flange, 97 mil)"
    },
    {
        "value": "800S300-118",
        "label": "800S300-118  (8in web, 3in flange, 118 mil)"
    },
    {
        "value": "800S350-54",
        "label": "800S350-54  (8in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "800S350-68",
        "label": "800S350-68  (8in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "800S350-97",
        "label": "800S350-97  (8in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "800S350-118",
        "label": "800S350-118  (8in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1000S162-43",
        "label": "1000S162-43  (10in web, 1.62in flange, 43 mil)"
    },
    {
        "value": "1000S162-54",
        "label": "1000S162-54  (10in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "1000S162-68",
        "label": "1000S162-68  (10in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1000S162-97",
        "label": "1000S162-97  (10in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1000S162-118",
        "label": "1000S162-118  (10in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1000S200-43",
        "label": "1000S200-43  (10in web, 2in flange, 43 mil)"
    },
    {
        "value": "1000S200-54",
        "label": "1000S200-54  (10in web, 2in flange, 54 mil)"
    },
    {
        "value": "1000S200-68",
        "label": "1000S200-68  (10in web, 2in flange, 68 mil)"
    },
    {
        "value": "1000S200-97",
        "label": "1000S200-97  (10in web, 2in flange, 97 mil)"
    },
    {
        "value": "1000S200-118",
        "label": "1000S200-118  (10in web, 2in flange, 118 mil)"
    },
    {
        "value": "1000S250-43",
        "label": "1000S250-43  (10in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "1000S250-54",
        "label": "1000S250-54  (10in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1000S250-68",
        "label": "1000S250-68  (10in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1000S250-97",
        "label": "1000S250-97  (10in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1000S250-118",
        "label": "1000S250-118  (10in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1000S300-54",
        "label": "1000S300-54  (10in web, 3in flange, 54 mil)"
    },
    {
        "value": "1000S300-68",
        "label": "1000S300-68  (10in web, 3in flange, 68 mil)"
    },
    {
        "value": "1000S300-97",
        "label": "1000S300-97  (10in web, 3in flange, 97 mil)"
    },
    {
        "value": "1000S300-118",
        "label": "1000S300-118  (10in web, 3in flange, 118 mil)"
    },
    {
        "value": "1000S350-54",
        "label": "1000S350-54  (10in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "1000S350-68",
        "label": "1000S350-68  (10in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1000S350-97",
        "label": "1000S350-97  (10in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1000S350-118",
        "label": "1000S350-118  (10in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1200S162-54",
        "label": "1200S162-54  (12in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "1200S162-68",
        "label": "1200S162-68  (12in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1200S162-97",
        "label": "1200S162-97  (12in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1200S162-118",
        "label": "1200S162-118  (12in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1200S200-54",
        "label": "1200S200-54  (12in web, 2in flange, 54 mil)"
    },
    {
        "value": "1200S200-68",
        "label": "1200S200-68  (12in web, 2in flange, 68 mil)"
    },
    {
        "value": "1200S200-97",
        "label": "1200S200-97  (12in web, 2in flange, 97 mil)"
    },
    {
        "value": "1200S200-118",
        "label": "1200S200-118  (12in web, 2in flange, 118 mil)"
    },
    {
        "value": "1200S250-54",
        "label": "1200S250-54  (12in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1200S250-68",
        "label": "1200S250-68  (12in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1200S250-97",
        "label": "1200S250-97  (12in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1200S250-118",
        "label": "1200S250-118  (12in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1200S300-54",
        "label": "1200S300-54  (12in web, 3in flange, 54 mil)"
    },
    {
        "value": "1200S300-68",
        "label": "1200S300-68  (12in web, 3in flange, 68 mil)"
    },
    {
        "value": "1200S300-97",
        "label": "1200S300-97  (12in web, 3in flange, 97 mil)"
    },
    {
        "value": "1200S300-118",
        "label": "1200S300-118  (12in web, 3in flange, 118 mil)"
    },
    {
        "value": "1200S350-54",
        "label": "1200S350-54  (12in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "1200S350-68",
        "label": "1200S350-68  (12in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1200S350-97",
        "label": "1200S350-97  (12in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1200S350-118",
        "label": "1200S350-118  (12in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1400S162-54",
        "label": "1400S162-54  (14in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "1400S162-68",
        "label": "1400S162-68  (14in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1400S162-97",
        "label": "1400S162-97  (14in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1400S162-118",
        "label": "1400S162-118  (14in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1400S200-54",
        "label": "1400S200-54  (14in web, 2in flange, 54 mil)"
    },
    {
        "value": "1400S200-68",
        "label": "1400S200-68  (14in web, 2in flange, 68 mil)"
    },
    {
        "value": "1400S200-97",
        "label": "1400S200-97  (14in web, 2in flange, 97 mil)"
    },
    {
        "value": "1400S200-118",
        "label": "1400S200-118  (14in web, 2in flange, 118 mil)"
    },
    {
        "value": "1400S250-54",
        "label": "1400S250-54  (14in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1400S250-68",
        "label": "1400S250-68  (14in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1400S250-97",
        "label": "1400S250-97  (14in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1400S250-118",
        "label": "1400S250-118  (14in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1400S300-54",
        "label": "1400S300-54  (14in web, 3in flange, 54 mil)"
    },
    {
        "value": "1400S300-68",
        "label": "1400S300-68  (14in web, 3in flange, 68 mil)"
    },
    {
        "value": "1400S300-97",
        "label": "1400S300-97  (14in web, 3in flange, 97 mil)"
    },
    {
        "value": "1400S300-118",
        "label": "1400S300-118  (14in web, 3in flange, 118 mil)"
    },
    {
        "value": "1400S350-54",
        "label": "1400S350-54  (14in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "1400S350-68",
        "label": "1400S350-68  (14in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1400S350-97",
        "label": "1400S350-97  (14in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1400S350-118",
        "label": "1400S350-118  (14in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1600S162-68",
        "label": "1600S162-68  (16in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1600S162-97",
        "label": "1600S162-97  (16in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1600S162-118",
        "label": "1600S162-118  (16in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1600S200-68",
        "label": "1600S200-68  (16in web, 2in flange, 68 mil)"
    },
    {
        "value": "1600S200-97",
        "label": "1600S200-97  (16in web, 2in flange, 97 mil)"
    },
    {
        "value": "1600S200-118",
        "label": "1600S200-118  (16in web, 2in flange, 118 mil)"
    },
    {
        "value": "1600S250-68",
        "label": "1600S250-68  (16in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1600S250-97",
        "label": "1600S250-97  (16in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1600S250-118",
        "label": "1600S250-118  (16in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1600S300-68",
        "label": "1600S300-68  (16in web, 3in flange, 68 mil)"
    },
    {
        "value": "1600S300-97",
        "label": "1600S300-97  (16in web, 3in flange, 97 mil)"
    },
    {
        "value": "1600S300-118",
        "label": "1600S300-118  (16in web, 3in flange, 118 mil)"
    },
    {
        "value": "1600S350-68",
        "label": "1600S350-68  (16in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1600S350-97",
        "label": "1600S350-97  (16in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1600S350-118",
        "label": "1600S350-118  (16in web, 3.5in flange, 118 mil)"
    }
];

  var studSections50ksi = [
    {
        "value": "250S125-54",
        "label": "250S125-54  (2.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "250S125-68",
        "label": "250S125-68  (2.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "250S137-54",
        "label": "250S137-54  (2.5in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "250S137-68",
        "label": "250S137-68  (2.5in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "250S137-97",
        "label": "250S137-97  (2.5in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "250S162-54",
        "label": "250S162-54  (2.5in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "250S162-68",
        "label": "250S162-68  (2.5in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "250S162-97",
        "label": "250S162-97  (2.5in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "250S200-54",
        "label": "250S200-54  (2.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "250S200-68",
        "label": "250S200-68  (2.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "250S200-97",
        "label": "250S200-97  (2.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "250S250-54",
        "label": "250S250-54  (2.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "250S250-68",
        "label": "250S250-68  (2.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "250S250-97",
        "label": "250S250-97  (2.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "350S125-54",
        "label": "350S125-54  (3.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "350S125-68",
        "label": "350S125-68  (3.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "350S137-54",
        "label": "350S137-54  (3.5in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "350S137-68",
        "label": "350S137-68  (3.5in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "350S137-97",
        "label": "350S137-97  (3.5in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "350S162-54",
        "label": "350S162-54  (3.5in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "350S162-68",
        "label": "350S162-68  (3.5in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "350S162-97",
        "label": "350S162-97  (3.5in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "350S200-54",
        "label": "350S200-54  (3.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "350S200-68",
        "label": "350S200-68  (3.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "350S200-97",
        "label": "350S200-97  (3.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "350S250-54",
        "label": "350S250-54  (3.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "350S250-68",
        "label": "350S250-68  (3.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "350S250-97",
        "label": "350S250-97  (3.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "362S125-54",
        "label": "362S125-54  (3.62in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "362S125-68",
        "label": "362S125-68  (3.62in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "362S137-54",
        "label": "362S137-54  (3.62in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "362S137-68",
        "label": "362S137-68  (3.62in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "362S137-97",
        "label": "362S137-97  (3.62in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "362S162-54",
        "label": "362S162-54  (3.62in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "362S162-68",
        "label": "362S162-68  (3.62in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "362S162-97",
        "label": "362S162-97  (3.62in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "362S200-54",
        "label": "362S200-54  (3.62in web, 2in flange, 54 mil)"
    },
    {
        "value": "362S200-68",
        "label": "362S200-68  (3.62in web, 2in flange, 68 mil)"
    },
    {
        "value": "362S200-97",
        "label": "362S200-97  (3.62in web, 2in flange, 97 mil)"
    },
    {
        "value": "362S250-54",
        "label": "362S250-54  (3.62in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "362S250-68",
        "label": "362S250-68  (3.62in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "362S250-97",
        "label": "362S250-97  (3.62in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "362S300-54",
        "label": "362S300-54  (3.62in web, 3in flange, 54 mil)"
    },
    {
        "value": "362S300-68",
        "label": "362S300-68  (3.62in web, 3in flange, 68 mil)"
    },
    {
        "value": "362S300-97",
        "label": "362S300-97  (3.62in web, 3in flange, 97 mil)"
    },
    {
        "value": "400S125-54",
        "label": "400S125-54  (4in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "400S125-68",
        "label": "400S125-68  (4in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "400S137-54",
        "label": "400S137-54  (4in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "400S137-68",
        "label": "400S137-68  (4in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "400S137-97",
        "label": "400S137-97  (4in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "400S162-54",
        "label": "400S162-54  (4in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "400S162-68",
        "label": "400S162-68  (4in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "400S162-97",
        "label": "400S162-97  (4in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "400S200-54",
        "label": "400S200-54  (4in web, 2in flange, 54 mil)"
    },
    {
        "value": "400S200-68",
        "label": "400S200-68  (4in web, 2in flange, 68 mil)"
    },
    {
        "value": "400S200-97",
        "label": "400S200-97  (4in web, 2in flange, 97 mil)"
    },
    {
        "value": "400S250-54",
        "label": "400S250-54  (4in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "400S250-68",
        "label": "400S250-68  (4in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "400S250-97",
        "label": "400S250-97  (4in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "400S300-54",
        "label": "400S300-54  (4in web, 3in flange, 54 mil)"
    },
    {
        "value": "400S300-68",
        "label": "400S300-68  (4in web, 3in flange, 68 mil)"
    },
    {
        "value": "400S300-97",
        "label": "400S300-97  (4in web, 3in flange, 97 mil)"
    },
    {
        "value": "550S125-54",
        "label": "550S125-54  (5.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "550S125-68",
        "label": "550S125-68  (5.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "550S137-54",
        "label": "550S137-54  (5.5in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "550S137-68",
        "label": "550S137-68  (5.5in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "550S137-97",
        "label": "550S137-97  (5.5in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "550S162-54",
        "label": "550S162-54  (5.5in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "550S162-68",
        "label": "550S162-68  (5.5in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "550S162-97",
        "label": "550S162-97  (5.5in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "550S200-54",
        "label": "550S200-54  (5.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "550S200-68",
        "label": "550S200-68  (5.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "550S200-97",
        "label": "550S200-97  (5.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "550S250-54",
        "label": "550S250-54  (5.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "550S250-68",
        "label": "550S250-68  (5.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "550S250-97",
        "label": "550S250-97  (5.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600S125-54",
        "label": "600S125-54  (6in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "600S125-68",
        "label": "600S125-68  (6in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "600S137-54",
        "label": "600S137-54  (6in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "600S137-68",
        "label": "600S137-68  (6in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "600S137-97",
        "label": "600S137-97  (6in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "600S137-118",
        "label": "600S137-118  (6in web, 1.37in flange, 118 mil)"
    },
    {
        "value": "600S162-54",
        "label": "600S162-54  (6in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "600S162-68",
        "label": "600S162-68  (6in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "600S162-97",
        "label": "600S162-97  (6in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "600S162-118",
        "label": "600S162-118  (6in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "600S200-54",
        "label": "600S200-54  (6in web, 2in flange, 54 mil)"
    },
    {
        "value": "600S200-68",
        "label": "600S200-68  (6in web, 2in flange, 68 mil)"
    },
    {
        "value": "600S200-97",
        "label": "600S200-97  (6in web, 2in flange, 97 mil)"
    },
    {
        "value": "600S200-118",
        "label": "600S200-118  (6in web, 2in flange, 118 mil)"
    },
    {
        "value": "600S250-54",
        "label": "600S250-54  (6in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "600S250-68",
        "label": "600S250-68  (6in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "600S250-97",
        "label": "600S250-97  (6in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600S250-118",
        "label": "600S250-118  (6in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "600S300-54",
        "label": "600S300-54  (6in web, 3in flange, 54 mil)"
    },
    {
        "value": "600S300-68",
        "label": "600S300-68  (6in web, 3in flange, 68 mil)"
    },
    {
        "value": "600S300-97",
        "label": "600S300-97  (6in web, 3in flange, 97 mil)"
    },
    {
        "value": "600S300-118",
        "label": "600S300-118  (6in web, 3in flange, 118 mil)"
    },
    {
        "value": "600S350-54",
        "label": "600S350-54  (6in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "600S350-68",
        "label": "600S350-68  (6in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "600S350-97",
        "label": "600S350-97  (6in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "600S350-118",
        "label": "600S350-118  (6in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "800S125-54",
        "label": "800S125-54  (8in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "800S125-68",
        "label": "800S125-68  (8in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "800S137-54",
        "label": "800S137-54  (8in web, 1.37in flange, 54 mil)"
    },
    {
        "value": "800S137-68",
        "label": "800S137-68  (8in web, 1.37in flange, 68 mil)"
    },
    {
        "value": "800S137-97",
        "label": "800S137-97  (8in web, 1.37in flange, 97 mil)"
    },
    {
        "value": "800S137-118",
        "label": "800S137-118  (8in web, 1.37in flange, 118 mil)"
    },
    {
        "value": "800S162-54",
        "label": "800S162-54  (8in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "800S162-68",
        "label": "800S162-68  (8in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "800S162-97",
        "label": "800S162-97  (8in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "800S162-118",
        "label": "800S162-118  (8in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "800S200-54",
        "label": "800S200-54  (8in web, 2in flange, 54 mil)"
    },
    {
        "value": "800S200-68",
        "label": "800S200-68  (8in web, 2in flange, 68 mil)"
    },
    {
        "value": "800S200-97",
        "label": "800S200-97  (8in web, 2in flange, 97 mil)"
    },
    {
        "value": "800S200-118",
        "label": "800S200-118  (8in web, 2in flange, 118 mil)"
    },
    {
        "value": "800S250-54",
        "label": "800S250-54  (8in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "800S250-68",
        "label": "800S250-68  (8in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "800S250-97",
        "label": "800S250-97  (8in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "800S250-118",
        "label": "800S250-118  (8in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "800S300-54",
        "label": "800S300-54  (8in web, 3in flange, 54 mil)"
    },
    {
        "value": "800S300-68",
        "label": "800S300-68  (8in web, 3in flange, 68 mil)"
    },
    {
        "value": "800S300-97",
        "label": "800S300-97  (8in web, 3in flange, 97 mil)"
    },
    {
        "value": "800S300-118",
        "label": "800S300-118  (8in web, 3in flange, 118 mil)"
    },
    {
        "value": "800S350-54",
        "label": "800S350-54  (8in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "800S350-68",
        "label": "800S350-68  (8in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "800S350-97",
        "label": "800S350-97  (8in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "800S350-118",
        "label": "800S350-118  (8in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1000S162-54",
        "label": "1000S162-54  (10in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "1000S162-68",
        "label": "1000S162-68  (10in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1000S162-97",
        "label": "1000S162-97  (10in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1000S162-118",
        "label": "1000S162-118  (10in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1000S200-54",
        "label": "1000S200-54  (10in web, 2in flange, 54 mil)"
    },
    {
        "value": "1000S200-68",
        "label": "1000S200-68  (10in web, 2in flange, 68 mil)"
    },
    {
        "value": "1000S200-97",
        "label": "1000S200-97  (10in web, 2in flange, 97 mil)"
    },
    {
        "value": "1000S200-118",
        "label": "1000S200-118  (10in web, 2in flange, 118 mil)"
    },
    {
        "value": "1000S250-54",
        "label": "1000S250-54  (10in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1000S250-68",
        "label": "1000S250-68  (10in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1000S250-97",
        "label": "1000S250-97  (10in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1000S250-118",
        "label": "1000S250-118  (10in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1000S300-54",
        "label": "1000S300-54  (10in web, 3in flange, 54 mil)"
    },
    {
        "value": "1000S300-68",
        "label": "1000S300-68  (10in web, 3in flange, 68 mil)"
    },
    {
        "value": "1000S300-97",
        "label": "1000S300-97  (10in web, 3in flange, 97 mil)"
    },
    {
        "value": "1000S300-118",
        "label": "1000S300-118  (10in web, 3in flange, 118 mil)"
    },
    {
        "value": "1000S350-54",
        "label": "1000S350-54  (10in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "1000S350-68",
        "label": "1000S350-68  (10in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1000S350-97",
        "label": "1000S350-97  (10in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1000S350-118",
        "label": "1000S350-118  (10in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1200S162-54",
        "label": "1200S162-54  (12in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "1200S162-68",
        "label": "1200S162-68  (12in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1200S162-97",
        "label": "1200S162-97  (12in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1200S162-118",
        "label": "1200S162-118  (12in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1200S200-54",
        "label": "1200S200-54  (12in web, 2in flange, 54 mil)"
    },
    {
        "value": "1200S200-68",
        "label": "1200S200-68  (12in web, 2in flange, 68 mil)"
    },
    {
        "value": "1200S200-97",
        "label": "1200S200-97  (12in web, 2in flange, 97 mil)"
    },
    {
        "value": "1200S200-118",
        "label": "1200S200-118  (12in web, 2in flange, 118 mil)"
    },
    {
        "value": "1200S250-54",
        "label": "1200S250-54  (12in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1200S250-68",
        "label": "1200S250-68  (12in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1200S250-97",
        "label": "1200S250-97  (12in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1200S250-118",
        "label": "1200S250-118  (12in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1200S300-54",
        "label": "1200S300-54  (12in web, 3in flange, 54 mil)"
    },
    {
        "value": "1200S300-68",
        "label": "1200S300-68  (12in web, 3in flange, 68 mil)"
    },
    {
        "value": "1200S300-97",
        "label": "1200S300-97  (12in web, 3in flange, 97 mil)"
    },
    {
        "value": "1200S300-118",
        "label": "1200S300-118  (12in web, 3in flange, 118 mil)"
    },
    {
        "value": "1200S350-54",
        "label": "1200S350-54  (12in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "1200S350-68",
        "label": "1200S350-68  (12in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1200S350-97",
        "label": "1200S350-97  (12in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1200S350-118",
        "label": "1200S350-118  (12in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1400S162-54",
        "label": "1400S162-54  (14in web, 1.62in flange, 54 mil)"
    },
    {
        "value": "1400S162-68",
        "label": "1400S162-68  (14in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1400S162-97",
        "label": "1400S162-97  (14in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1400S162-118",
        "label": "1400S162-118  (14in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1400S200-54",
        "label": "1400S200-54  (14in web, 2in flange, 54 mil)"
    },
    {
        "value": "1400S200-68",
        "label": "1400S200-68  (14in web, 2in flange, 68 mil)"
    },
    {
        "value": "1400S200-97",
        "label": "1400S200-97  (14in web, 2in flange, 97 mil)"
    },
    {
        "value": "1400S200-118",
        "label": "1400S200-118  (14in web, 2in flange, 118 mil)"
    },
    {
        "value": "1400S250-54",
        "label": "1400S250-54  (14in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1400S250-68",
        "label": "1400S250-68  (14in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1400S250-97",
        "label": "1400S250-97  (14in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1400S250-118",
        "label": "1400S250-118  (14in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1400S300-54",
        "label": "1400S300-54  (14in web, 3in flange, 54 mil)"
    },
    {
        "value": "1400S300-68",
        "label": "1400S300-68  (14in web, 3in flange, 68 mil)"
    },
    {
        "value": "1400S300-97",
        "label": "1400S300-97  (14in web, 3in flange, 97 mil)"
    },
    {
        "value": "1400S300-118",
        "label": "1400S300-118  (14in web, 3in flange, 118 mil)"
    },
    {
        "value": "1400S350-54",
        "label": "1400S350-54  (14in web, 3.5in flange, 54 mil)"
    },
    {
        "value": "1400S350-68",
        "label": "1400S350-68  (14in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1400S350-97",
        "label": "1400S350-97  (14in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1400S350-118",
        "label": "1400S350-118  (14in web, 3.5in flange, 118 mil)"
    },
    {
        "value": "1600S162-68",
        "label": "1600S162-68  (16in web, 1.62in flange, 68 mil)"
    },
    {
        "value": "1600S162-97",
        "label": "1600S162-97  (16in web, 1.62in flange, 97 mil)"
    },
    {
        "value": "1600S162-118",
        "label": "1600S162-118  (16in web, 1.62in flange, 118 mil)"
    },
    {
        "value": "1600S200-68",
        "label": "1600S200-68  (16in web, 2in flange, 68 mil)"
    },
    {
        "value": "1600S200-97",
        "label": "1600S200-97  (16in web, 2in flange, 97 mil)"
    },
    {
        "value": "1600S200-118",
        "label": "1600S200-118  (16in web, 2in flange, 118 mil)"
    },
    {
        "value": "1600S250-68",
        "label": "1600S250-68  (16in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1600S250-97",
        "label": "1600S250-97  (16in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1600S250-118",
        "label": "1600S250-118  (16in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1600S300-68",
        "label": "1600S300-68  (16in web, 3in flange, 68 mil)"
    },
    {
        "value": "1600S300-97",
        "label": "1600S300-97  (16in web, 3in flange, 97 mil)"
    },
    {
        "value": "1600S300-118",
        "label": "1600S300-118  (16in web, 3in flange, 118 mil)"
    },
    {
        "value": "1600S350-68",
        "label": "1600S350-68  (16in web, 3.5in flange, 68 mil)"
    },
    {
        "value": "1600S350-97",
        "label": "1600S350-97  (16in web, 3.5in flange, 97 mil)"
    },
    {
        "value": "1600S350-118",
        "label": "1600S350-118  (16in web, 3.5in flange, 118 mil)"
    }
];

  var trackSections = [
    {
        "value": "162T125-18",
        "label": "162T125-18  (1.62in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "162T125-27",
        "label": "162T125-27  (1.62in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "162T125-30",
        "label": "162T125-30  (1.62in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "162T125-33",
        "label": "162T125-33  (1.62in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "250T125-18",
        "label": "250T125-18  (2.5in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "250T125-27",
        "label": "250T125-27  (2.5in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "250T125-30",
        "label": "250T125-30  (2.5in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "250T125-33",
        "label": "250T125-33  (2.5in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "250T125-43",
        "label": "250T125-43  (2.5in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "250T125-54",
        "label": "250T125-54  (2.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "250T125-68",
        "label": "250T125-68  (2.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "250T125-97",
        "label": "250T125-97  (2.5in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "250T150-27",
        "label": "250T150-27  (2.5in web, 1.5in flange, 27 mil)"
    },
    {
        "value": "250T150-30",
        "label": "250T150-30  (2.5in web, 1.5in flange, 30 mil)"
    },
    {
        "value": "250T150-33",
        "label": "250T150-33  (2.5in web, 1.5in flange, 33 mil)"
    },
    {
        "value": "250T150-43",
        "label": "250T150-43  (2.5in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "250T150-54",
        "label": "250T150-54  (2.5in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "250T150-68",
        "label": "250T150-68  (2.5in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "250T150-97",
        "label": "250T150-97  (2.5in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "250T200-33",
        "label": "250T200-33  (2.5in web, 2in flange, 33 mil)"
    },
    {
        "value": "250T200-43",
        "label": "250T200-43  (2.5in web, 2in flange, 43 mil)"
    },
    {
        "value": "250T200-54",
        "label": "250T200-54  (2.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "250T200-68",
        "label": "250T200-68  (2.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "250T200-97",
        "label": "250T200-97  (2.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "350T125-18",
        "label": "350T125-18  (3.5in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "350T125-27",
        "label": "350T125-27  (3.5in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "350T125-30",
        "label": "350T125-30  (3.5in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "350T125-33",
        "label": "350T125-33  (3.5in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "350T125-43",
        "label": "350T125-43  (3.5in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "350T125-54",
        "label": "350T125-54  (3.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "350T125-68",
        "label": "350T125-68  (3.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "350T125-97",
        "label": "350T125-97  (3.5in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "350T150-27",
        "label": "350T150-27  (3.5in web, 1.5in flange, 27 mil)"
    },
    {
        "value": "350T150-30",
        "label": "350T150-30  (3.5in web, 1.5in flange, 30 mil)"
    },
    {
        "value": "350T150-33",
        "label": "350T150-33  (3.5in web, 1.5in flange, 33 mil)"
    },
    {
        "value": "350T150-43",
        "label": "350T150-43  (3.5in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "350T150-54",
        "label": "350T150-54  (3.5in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "350T150-68",
        "label": "350T150-68  (3.5in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "350T150-97",
        "label": "350T150-97  (3.5in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "350T200-33",
        "label": "350T200-33  (3.5in web, 2in flange, 33 mil)"
    },
    {
        "value": "350T200-43",
        "label": "350T200-43  (3.5in web, 2in flange, 43 mil)"
    },
    {
        "value": "350T200-54",
        "label": "350T200-54  (3.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "350T200-68",
        "label": "350T200-68  (3.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "350T200-97",
        "label": "350T200-97  (3.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "350T250-54",
        "label": "350T250-54  (3.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "350T250-68",
        "label": "350T250-68  (3.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "350T250-97",
        "label": "350T250-97  (3.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "362T125-18",
        "label": "362T125-18  (3.62in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "362T125-27",
        "label": "362T125-27  (3.62in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "362T125-30",
        "label": "362T125-30  (3.62in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "362T125-33",
        "label": "362T125-33  (3.62in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "362T125-43",
        "label": "362T125-43  (3.62in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "362T125-54",
        "label": "362T125-54  (3.62in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "362T125-68",
        "label": "362T125-68  (3.62in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "362T125-97",
        "label": "362T125-97  (3.62in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "362T150-27",
        "label": "362T150-27  (3.62in web, 1.5in flange, 27 mil)"
    },
    {
        "value": "362T150-30",
        "label": "362T150-30  (3.62in web, 1.5in flange, 30 mil)"
    },
    {
        "value": "362T150-33",
        "label": "362T150-33  (3.62in web, 1.5in flange, 33 mil)"
    },
    {
        "value": "362T150-43",
        "label": "362T150-43  (3.62in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "362T150-54",
        "label": "362T150-54  (3.62in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "362T150-68",
        "label": "362T150-68  (3.62in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "362T150-97",
        "label": "362T150-97  (3.62in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "362T200-33",
        "label": "362T200-33  (3.62in web, 2in flange, 33 mil)"
    },
    {
        "value": "362T200-43",
        "label": "362T200-43  (3.62in web, 2in flange, 43 mil)"
    },
    {
        "value": "362T200-54",
        "label": "362T200-54  (3.62in web, 2in flange, 54 mil)"
    },
    {
        "value": "362T200-68",
        "label": "362T200-68  (3.62in web, 2in flange, 68 mil)"
    },
    {
        "value": "362T200-97",
        "label": "362T200-97  (3.62in web, 2in flange, 97 mil)"
    },
    {
        "value": "362T250-54",
        "label": "362T250-54  (3.62in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "362T250-68",
        "label": "362T250-68  (3.62in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "362T250-97",
        "label": "362T250-97  (3.62in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "400T125-18",
        "label": "400T125-18  (4in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "400T125-27",
        "label": "400T125-27  (4in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "400T125-30",
        "label": "400T125-30  (4in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "400T125-33",
        "label": "400T125-33  (4in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "400T125-43",
        "label": "400T125-43  (4in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "400T125-54",
        "label": "400T125-54  (4in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "400T125-68",
        "label": "400T125-68  (4in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "400T125-97",
        "label": "400T125-97  (4in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "400T150-27",
        "label": "400T150-27  (4in web, 1.5in flange, 27 mil)"
    },
    {
        "value": "400T150-30",
        "label": "400T150-30  (4in web, 1.5in flange, 30 mil)"
    },
    {
        "value": "400T150-33",
        "label": "400T150-33  (4in web, 1.5in flange, 33 mil)"
    },
    {
        "value": "400T150-43",
        "label": "400T150-43  (4in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "400T150-54",
        "label": "400T150-54  (4in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "400T150-68",
        "label": "400T150-68  (4in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "400T150-97",
        "label": "400T150-97  (4in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "400T200-33",
        "label": "400T200-33  (4in web, 2in flange, 33 mil)"
    },
    {
        "value": "400T200-43",
        "label": "400T200-43  (4in web, 2in flange, 43 mil)"
    },
    {
        "value": "400T200-54",
        "label": "400T200-54  (4in web, 2in flange, 54 mil)"
    },
    {
        "value": "400T200-68",
        "label": "400T200-68  (4in web, 2in flange, 68 mil)"
    },
    {
        "value": "400T200-97",
        "label": "400T200-97  (4in web, 2in flange, 97 mil)"
    },
    {
        "value": "400T250-43",
        "label": "400T250-43  (4in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "400T250-54",
        "label": "400T250-54  (4in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "400T250-68",
        "label": "400T250-68  (4in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "400T250-97",
        "label": "400T250-97  (4in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "550T125-18",
        "label": "550T125-18  (5.5in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "550T125-27",
        "label": "550T125-27  (5.5in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "550T125-30",
        "label": "550T125-30  (5.5in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "550T125-33",
        "label": "550T125-33  (5.5in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "550T125-43",
        "label": "550T125-43  (5.5in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "550T125-54",
        "label": "550T125-54  (5.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "550T125-68",
        "label": "550T125-68  (5.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "550T125-97",
        "label": "550T125-97  (5.5in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "550T150-27",
        "label": "550T150-27  (5.5in web, 1.5in flange, 27 mil)"
    },
    {
        "value": "550T150-30",
        "label": "550T150-30  (5.5in web, 1.5in flange, 30 mil)"
    },
    {
        "value": "550T150-33",
        "label": "550T150-33  (5.5in web, 1.5in flange, 33 mil)"
    },
    {
        "value": "550T150-43",
        "label": "550T150-43  (5.5in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "550T150-54",
        "label": "550T150-54  (5.5in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "550T150-68",
        "label": "550T150-68  (5.5in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "550T150-97",
        "label": "550T150-97  (5.5in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "550T200-33",
        "label": "550T200-33  (5.5in web, 2in flange, 33 mil)"
    },
    {
        "value": "550T200-43",
        "label": "550T200-43  (5.5in web, 2in flange, 43 mil)"
    },
    {
        "value": "550T200-54",
        "label": "550T200-54  (5.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "550T200-68",
        "label": "550T200-68  (5.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "550T200-97",
        "label": "550T200-97  (5.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "550T250-43",
        "label": "550T250-43  (5.5in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "550T250-54",
        "label": "550T250-54  (5.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "550T250-68",
        "label": "550T250-68  (5.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "550T250-97",
        "label": "550T250-97  (5.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600T125-18",
        "label": "600T125-18  (6in web, 1.25in flange, 18 mil)"
    },
    {
        "value": "600T125-27",
        "label": "600T125-27  (6in web, 1.25in flange, 27 mil)"
    },
    {
        "value": "600T125-30",
        "label": "600T125-30  (6in web, 1.25in flange, 30 mil)"
    },
    {
        "value": "600T125-33",
        "label": "600T125-33  (6in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "600T125-43",
        "label": "600T125-43  (6in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "600T125-54",
        "label": "600T125-54  (6in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "600T125-68",
        "label": "600T125-68  (6in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "600T125-97",
        "label": "600T125-97  (6in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "600T125-118",
        "label": "600T125-118  (6in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "600T150-27",
        "label": "600T150-27  (6in web, 1.5in flange, 27 mil)"
    },
    {
        "value": "600T150-30",
        "label": "600T150-30  (6in web, 1.5in flange, 30 mil)"
    },
    {
        "value": "600T150-33",
        "label": "600T150-33  (6in web, 1.5in flange, 33 mil)"
    },
    {
        "value": "600T150-43",
        "label": "600T150-43  (6in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "600T150-54",
        "label": "600T150-54  (6in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "600T150-68",
        "label": "600T150-68  (6in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "600T150-97",
        "label": "600T150-97  (6in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "600T150-118",
        "label": "600T150-118  (6in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "600T200-33",
        "label": "600T200-33  (6in web, 2in flange, 33 mil)"
    },
    {
        "value": "600T200-43",
        "label": "600T200-43  (6in web, 2in flange, 43 mil)"
    },
    {
        "value": "600T200-54",
        "label": "600T200-54  (6in web, 2in flange, 54 mil)"
    },
    {
        "value": "600T200-68",
        "label": "600T200-68  (6in web, 2in flange, 68 mil)"
    },
    {
        "value": "600T200-97",
        "label": "600T200-97  (6in web, 2in flange, 97 mil)"
    },
    {
        "value": "600T250-43",
        "label": "600T250-43  (6in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "600T250-54",
        "label": "600T250-54  (6in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "600T250-68",
        "label": "600T250-68  (6in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "600T250-97",
        "label": "600T250-97  (6in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600T250-118",
        "label": "600T250-118  (6in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "800T125-33",
        "label": "800T125-33  (8in web, 1.25in flange, 33 mil)"
    },
    {
        "value": "800T125-43",
        "label": "800T125-43  (8in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "800T125-54",
        "label": "800T125-54  (8in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "800T125-68",
        "label": "800T125-68  (8in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "800T125-97",
        "label": "800T125-97  (8in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "800T125-118",
        "label": "800T125-118  (8in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "800T150-33",
        "label": "800T150-33  (8in web, 1.5in flange, 33 mil)"
    },
    {
        "value": "800T150-43",
        "label": "800T150-43  (8in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "800T150-54",
        "label": "800T150-54  (8in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "800T150-68",
        "label": "800T150-68  (8in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "800T150-97",
        "label": "800T150-97  (8in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "800T150-118",
        "label": "800T150-118  (8in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "800T200-33",
        "label": "800T200-33  (8in web, 2in flange, 33 mil)"
    },
    {
        "value": "800T200-43",
        "label": "800T200-43  (8in web, 2in flange, 43 mil)"
    },
    {
        "value": "800T200-54",
        "label": "800T200-54  (8in web, 2in flange, 54 mil)"
    },
    {
        "value": "800T200-68",
        "label": "800T200-68  (8in web, 2in flange, 68 mil)"
    },
    {
        "value": "800T200-97",
        "label": "800T200-97  (8in web, 2in flange, 97 mil)"
    },
    {
        "value": "800T200-118",
        "label": "800T200-118  (8in web, 2in flange, 118 mil)"
    },
    {
        "value": "800T250-43",
        "label": "800T250-43  (8in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "800T250-54",
        "label": "800T250-54  (8in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "800T250-68",
        "label": "800T250-68  (8in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "800T250-97",
        "label": "800T250-97  (8in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "800T250-118",
        "label": "800T250-118  (8in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1000T125-43",
        "label": "1000T125-43  (10in web, 1.25in flange, 43 mil)"
    },
    {
        "value": "1000T125-54",
        "label": "1000T125-54  (10in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "1000T125-68",
        "label": "1000T125-68  (10in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1000T125-97",
        "label": "1000T125-97  (10in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1000T125-118",
        "label": "1000T125-118  (10in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1000T150-43",
        "label": "1000T150-43  (10in web, 1.5in flange, 43 mil)"
    },
    {
        "value": "1000T150-54",
        "label": "1000T150-54  (10in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "1000T150-68",
        "label": "1000T150-68  (10in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1000T150-97",
        "label": "1000T150-97  (10in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1000T150-118",
        "label": "1000T150-118  (10in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "1000T200-43",
        "label": "1000T200-43  (10in web, 2in flange, 43 mil)"
    },
    {
        "value": "1000T200-54",
        "label": "1000T200-54  (10in web, 2in flange, 54 mil)"
    },
    {
        "value": "1000T200-68",
        "label": "1000T200-68  (10in web, 2in flange, 68 mil)"
    },
    {
        "value": "1000T200-97",
        "label": "1000T200-97  (10in web, 2in flange, 97 mil)"
    },
    {
        "value": "1000T200-118",
        "label": "1000T200-118  (10in web, 2in flange, 118 mil)"
    },
    {
        "value": "1000T250-43",
        "label": "1000T250-43  (10in web, 2.5in flange, 43 mil)"
    },
    {
        "value": "1000T250-54",
        "label": "1000T250-54  (10in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1000T250-68",
        "label": "1000T250-68  (10in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1000T250-97",
        "label": "1000T250-97  (10in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1000T250-118",
        "label": "1000T250-118  (10in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1200T125-54",
        "label": "1200T125-54  (12in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "1200T125-68",
        "label": "1200T125-68  (12in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1200T125-97",
        "label": "1200T125-97  (12in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1200T125-118",
        "label": "1200T125-118  (12in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1200T150-54",
        "label": "1200T150-54  (12in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "1200T150-68",
        "label": "1200T150-68  (12in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1200T150-97",
        "label": "1200T150-97  (12in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1200T150-118",
        "label": "1200T150-118  (12in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "1200T200-54",
        "label": "1200T200-54  (12in web, 2in flange, 54 mil)"
    },
    {
        "value": "1200T200-68",
        "label": "1200T200-68  (12in web, 2in flange, 68 mil)"
    },
    {
        "value": "1200T200-97",
        "label": "1200T200-97  (12in web, 2in flange, 97 mil)"
    },
    {
        "value": "1200T200-118",
        "label": "1200T200-118  (12in web, 2in flange, 118 mil)"
    },
    {
        "value": "1200T250-54",
        "label": "1200T250-54  (12in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1200T250-68",
        "label": "1200T250-68  (12in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1200T250-97",
        "label": "1200T250-97  (12in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1200T250-118",
        "label": "1200T250-118  (12in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1400T125-54",
        "label": "1400T125-54  (14in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "1400T125-68",
        "label": "1400T125-68  (14in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1400T125-97",
        "label": "1400T125-97  (14in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1400T125-118",
        "label": "1400T125-118  (14in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1400T150-54",
        "label": "1400T150-54  (14in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "1400T150-68",
        "label": "1400T150-68  (14in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1400T150-97",
        "label": "1400T150-97  (14in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1400T150-118",
        "label": "1400T150-118  (14in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "1400T200-54",
        "label": "1400T200-54  (14in web, 2in flange, 54 mil)"
    },
    {
        "value": "1400T200-68",
        "label": "1400T200-68  (14in web, 2in flange, 68 mil)"
    },
    {
        "value": "1400T200-97",
        "label": "1400T200-97  (14in web, 2in flange, 97 mil)"
    },
    {
        "value": "1400T200-118",
        "label": "1400T200-118  (14in web, 2in flange, 118 mil)"
    },
    {
        "value": "1400T250-54",
        "label": "1400T250-54  (14in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1400T250-68",
        "label": "1400T250-68  (14in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1400T250-97",
        "label": "1400T250-97  (14in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1400T250-118",
        "label": "1400T250-118  (14in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1600T125-68",
        "label": "1600T125-68  (16in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1600T125-97",
        "label": "1600T125-97  (16in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1600T125-118",
        "label": "1600T125-118  (16in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1600T150-68",
        "label": "1600T150-68  (16in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1600T150-97",
        "label": "1600T150-97  (16in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1600T200-68",
        "label": "1600T200-68  (16in web, 2in flange, 68 mil)"
    },
    {
        "value": "1600T200-97",
        "label": "1600T200-97  (16in web, 2in flange, 97 mil)"
    },
    {
        "value": "1600T200-118",
        "label": "1600T200-118  (16in web, 2in flange, 118 mil)"
    },
    {
        "value": "1600T250-68",
        "label": "1600T250-68  (16in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1600T250-97",
        "label": "1600T250-97  (16in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1600T250-118",
        "label": "1600T250-118  (16in web, 2.5in flange, 118 mil)"
    }
];

  var trackSections50ksi = [
    {
        "value": "250T125-54",
        "label": "250T125-54  (2.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "250T125-68",
        "label": "250T125-68  (2.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "250T125-97",
        "label": "250T125-97  (2.5in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "250T150-54",
        "label": "250T150-54  (2.5in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "250T150-68",
        "label": "250T150-68  (2.5in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "250T150-97",
        "label": "250T150-97  (2.5in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "250T200-54",
        "label": "250T200-54  (2.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "250T200-68",
        "label": "250T200-68  (2.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "250T200-97",
        "label": "250T200-97  (2.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "350T125-54",
        "label": "350T125-54  (3.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "350T125-68",
        "label": "350T125-68  (3.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "350T125-97",
        "label": "350T125-97  (3.5in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "350T150-54",
        "label": "350T150-54  (3.5in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "350T150-68",
        "label": "350T150-68  (3.5in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "350T150-97",
        "label": "350T150-97  (3.5in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "350T200-54",
        "label": "350T200-54  (3.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "350T200-68",
        "label": "350T200-68  (3.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "350T200-97",
        "label": "350T200-97  (3.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "350T250-54",
        "label": "350T250-54  (3.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "350T250-68",
        "label": "350T250-68  (3.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "350T250-97",
        "label": "350T250-97  (3.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "362T125-54",
        "label": "362T125-54  (3.62in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "362T125-68",
        "label": "362T125-68  (3.62in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "362T125-97",
        "label": "362T125-97  (3.62in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "362T150-54",
        "label": "362T150-54  (3.62in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "362T150-68",
        "label": "362T150-68  (3.62in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "362T150-97",
        "label": "362T150-97  (3.62in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "362T200-54",
        "label": "362T200-54  (3.62in web, 2in flange, 54 mil)"
    },
    {
        "value": "362T200-68",
        "label": "362T200-68  (3.62in web, 2in flange, 68 mil)"
    },
    {
        "value": "362T200-97",
        "label": "362T200-97  (3.62in web, 2in flange, 97 mil)"
    },
    {
        "value": "362T250-54",
        "label": "362T250-54  (3.62in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "362T250-68",
        "label": "362T250-68  (3.62in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "362T250-97",
        "label": "362T250-97  (3.62in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "400T125-54",
        "label": "400T125-54  (4in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "400T125-68",
        "label": "400T125-68  (4in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "400T125-97",
        "label": "400T125-97  (4in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "400T150-54",
        "label": "400T150-54  (4in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "400T150-68",
        "label": "400T150-68  (4in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "400T150-97",
        "label": "400T150-97  (4in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "400T200-54",
        "label": "400T200-54  (4in web, 2in flange, 54 mil)"
    },
    {
        "value": "400T200-68",
        "label": "400T200-68  (4in web, 2in flange, 68 mil)"
    },
    {
        "value": "400T200-97",
        "label": "400T200-97  (4in web, 2in flange, 97 mil)"
    },
    {
        "value": "400T250-54",
        "label": "400T250-54  (4in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "400T250-68",
        "label": "400T250-68  (4in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "400T250-97",
        "label": "400T250-97  (4in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "550T125-54",
        "label": "550T125-54  (5.5in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "550T125-68",
        "label": "550T125-68  (5.5in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "550T125-97",
        "label": "550T125-97  (5.5in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "550T150-54",
        "label": "550T150-54  (5.5in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "550T150-68",
        "label": "550T150-68  (5.5in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "550T150-97",
        "label": "550T150-97  (5.5in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "550T200-54",
        "label": "550T200-54  (5.5in web, 2in flange, 54 mil)"
    },
    {
        "value": "550T200-68",
        "label": "550T200-68  (5.5in web, 2in flange, 68 mil)"
    },
    {
        "value": "550T200-97",
        "label": "550T200-97  (5.5in web, 2in flange, 97 mil)"
    },
    {
        "value": "550T250-54",
        "label": "550T250-54  (5.5in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "550T250-68",
        "label": "550T250-68  (5.5in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "550T250-97",
        "label": "550T250-97  (5.5in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600T125-54",
        "label": "600T125-54  (6in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "600T125-68",
        "label": "600T125-68  (6in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "600T125-97",
        "label": "600T125-97  (6in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "600T125-118",
        "label": "600T125-118  (6in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "600T150-54",
        "label": "600T150-54  (6in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "600T150-68",
        "label": "600T150-68  (6in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "600T150-97",
        "label": "600T150-97  (6in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "600T150-118",
        "label": "600T150-118  (6in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "600T200-54",
        "label": "600T200-54  (6in web, 2in flange, 54 mil)"
    },
    {
        "value": "600T200-68",
        "label": "600T200-68  (6in web, 2in flange, 68 mil)"
    },
    {
        "value": "600T200-97",
        "label": "600T200-97  (6in web, 2in flange, 97 mil)"
    },
    {
        "value": "600T250-54",
        "label": "600T250-54  (6in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "600T250-68",
        "label": "600T250-68  (6in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "600T250-97",
        "label": "600T250-97  (6in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "600T250-118",
        "label": "600T250-118  (6in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "800T125-54",
        "label": "800T125-54  (8in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "800T125-68",
        "label": "800T125-68  (8in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "800T125-97",
        "label": "800T125-97  (8in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "800T125-118",
        "label": "800T125-118  (8in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "800T150-54",
        "label": "800T150-54  (8in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "800T150-68",
        "label": "800T150-68  (8in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "800T150-97",
        "label": "800T150-97  (8in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "800T150-118",
        "label": "800T150-118  (8in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "800T200-54",
        "label": "800T200-54  (8in web, 2in flange, 54 mil)"
    },
    {
        "value": "800T200-68",
        "label": "800T200-68  (8in web, 2in flange, 68 mil)"
    },
    {
        "value": "800T200-97",
        "label": "800T200-97  (8in web, 2in flange, 97 mil)"
    },
    {
        "value": "800T200-118",
        "label": "800T200-118  (8in web, 2in flange, 118 mil)"
    },
    {
        "value": "800T250-54",
        "label": "800T250-54  (8in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "800T250-68",
        "label": "800T250-68  (8in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "800T250-97",
        "label": "800T250-97  (8in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "800T250-118",
        "label": "800T250-118  (8in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1000T125-54",
        "label": "1000T125-54  (10in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "1000T125-68",
        "label": "1000T125-68  (10in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1000T125-97",
        "label": "1000T125-97  (10in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1000T125-118",
        "label": "1000T125-118  (10in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1000T150-54",
        "label": "1000T150-54  (10in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "1000T150-68",
        "label": "1000T150-68  (10in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1000T150-97",
        "label": "1000T150-97  (10in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1000T150-118",
        "label": "1000T150-118  (10in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "1000T200-54",
        "label": "1000T200-54  (10in web, 2in flange, 54 mil)"
    },
    {
        "value": "1000T200-68",
        "label": "1000T200-68  (10in web, 2in flange, 68 mil)"
    },
    {
        "value": "1000T200-97",
        "label": "1000T200-97  (10in web, 2in flange, 97 mil)"
    },
    {
        "value": "1000T200-118",
        "label": "1000T200-118  (10in web, 2in flange, 118 mil)"
    },
    {
        "value": "1000T250-54",
        "label": "1000T250-54  (10in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1000T250-68",
        "label": "1000T250-68  (10in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1000T250-97",
        "label": "1000T250-97  (10in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1000T250-118",
        "label": "1000T250-118  (10in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1200T125-54",
        "label": "1200T125-54  (12in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "1200T125-68",
        "label": "1200T125-68  (12in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1200T125-97",
        "label": "1200T125-97  (12in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1200T125-118",
        "label": "1200T125-118  (12in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1200T150-54",
        "label": "1200T150-54  (12in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "1200T150-68",
        "label": "1200T150-68  (12in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1200T150-97",
        "label": "1200T150-97  (12in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1200T150-118",
        "label": "1200T150-118  (12in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "1200T200-54",
        "label": "1200T200-54  (12in web, 2in flange, 54 mil)"
    },
    {
        "value": "1200T200-68",
        "label": "1200T200-68  (12in web, 2in flange, 68 mil)"
    },
    {
        "value": "1200T200-97",
        "label": "1200T200-97  (12in web, 2in flange, 97 mil)"
    },
    {
        "value": "1200T200-118",
        "label": "1200T200-118  (12in web, 2in flange, 118 mil)"
    },
    {
        "value": "1200T250-54",
        "label": "1200T250-54  (12in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1200T250-68",
        "label": "1200T250-68  (12in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1200T250-97",
        "label": "1200T250-97  (12in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1200T250-118",
        "label": "1200T250-118  (12in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1400T125-54",
        "label": "1400T125-54  (14in web, 1.25in flange, 54 mil)"
    },
    {
        "value": "1400T125-68",
        "label": "1400T125-68  (14in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1400T125-97",
        "label": "1400T125-97  (14in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1400T125-118",
        "label": "1400T125-118  (14in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1400T150-54",
        "label": "1400T150-54  (14in web, 1.5in flange, 54 mil)"
    },
    {
        "value": "1400T150-68",
        "label": "1400T150-68  (14in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1400T150-97",
        "label": "1400T150-97  (14in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1400T150-118",
        "label": "1400T150-118  (14in web, 1.5in flange, 118 mil)"
    },
    {
        "value": "1400T200-54",
        "label": "1400T200-54  (14in web, 2in flange, 54 mil)"
    },
    {
        "value": "1400T200-68",
        "label": "1400T200-68  (14in web, 2in flange, 68 mil)"
    },
    {
        "value": "1400T200-97",
        "label": "1400T200-97  (14in web, 2in flange, 97 mil)"
    },
    {
        "value": "1400T200-118",
        "label": "1400T200-118  (14in web, 2in flange, 118 mil)"
    },
    {
        "value": "1400T250-54",
        "label": "1400T250-54  (14in web, 2.5in flange, 54 mil)"
    },
    {
        "value": "1400T250-68",
        "label": "1400T250-68  (14in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1400T250-97",
        "label": "1400T250-97  (14in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1400T250-118",
        "label": "1400T250-118  (14in web, 2.5in flange, 118 mil)"
    },
    {
        "value": "1600T125-68",
        "label": "1600T125-68  (16in web, 1.25in flange, 68 mil)"
    },
    {
        "value": "1600T125-97",
        "label": "1600T125-97  (16in web, 1.25in flange, 97 mil)"
    },
    {
        "value": "1600T125-118",
        "label": "1600T125-118  (16in web, 1.25in flange, 118 mil)"
    },
    {
        "value": "1600T150-68",
        "label": "1600T150-68  (16in web, 1.5in flange, 68 mil)"
    },
    {
        "value": "1600T150-97",
        "label": "1600T150-97  (16in web, 1.5in flange, 97 mil)"
    },
    {
        "value": "1600T200-68",
        "label": "1600T200-68  (16in web, 2in flange, 68 mil)"
    },
    {
        "value": "1600T200-97",
        "label": "1600T200-97  (16in web, 2in flange, 97 mil)"
    },
    {
        "value": "1600T200-118",
        "label": "1600T200-118  (16in web, 2in flange, 118 mil)"
    },
    {
        "value": "1600T250-68",
        "label": "1600T250-68  (16in web, 2.5in flange, 68 mil)"
    },
    {
        "value": "1600T250-97",
        "label": "1600T250-97  (16in web, 2.5in flange, 97 mil)"
    },
    {
        "value": "1600T250-118",
        "label": "1600T250-118  (16in web, 2.5in flange, 118 mil)"
    }
];

  var studSectionsByDepth = {
    "1.62in": [
        "162S125-18",
        "162S125-27",
        "162S125-30",
        "162S125-33"
    ],
    "2.5in": [
        "250S125-18",
        "250S125-27",
        "250S125-30",
        "250S125-33",
        "250S125-43",
        "250S125-54",
        "250S125-68",
        "250S137-33",
        "250S137-43",
        "250S137-54",
        "250S137-68",
        "250S137-97",
        "250S162-33",
        "250S162-43",
        "250S162-54",
        "250S162-68",
        "250S162-97",
        "250S200-33",
        "250S200-43",
        "250S200-54",
        "250S200-68",
        "250S200-97",
        "250S250-43",
        "250S250-54",
        "250S250-68",
        "250S250-97"
    ],
    "3.5in": [
        "350S125-18",
        "350S125-27",
        "350S125-30",
        "350S125-33",
        "350S125-43",
        "350S125-54",
        "350S125-68",
        "350S137-33",
        "350S137-43",
        "350S137-54",
        "350S137-68",
        "350S137-97",
        "350S162-33",
        "350S162-43",
        "350S162-54",
        "350S162-68",
        "350S162-97",
        "350S200-33",
        "350S200-43",
        "350S200-54",
        "350S200-68",
        "350S200-97",
        "350S250-43",
        "350S250-54",
        "350S250-68",
        "350S250-97"
    ],
    "3.62in": [
        "362S125-18",
        "362S125-27",
        "362S125-30",
        "362S125-33",
        "362S125-43",
        "362S125-54",
        "362S125-68",
        "362S137-33",
        "362S137-43",
        "362S137-54",
        "362S137-68",
        "362S137-97",
        "362S162-33",
        "362S162-43",
        "362S162-54",
        "362S162-68",
        "362S162-97",
        "362S200-33",
        "362S200-43",
        "362S200-54",
        "362S200-68",
        "362S200-97",
        "362S250-43",
        "362S250-54",
        "362S250-68",
        "362S250-97",
        "362S300-54",
        "362S300-68",
        "362S300-97"
    ],
    "4in": [
        "400S125-18",
        "400S125-27",
        "400S125-30",
        "400S125-33",
        "400S125-43",
        "400S125-54",
        "400S125-68",
        "400S137-33",
        "400S137-43",
        "400S137-54",
        "400S137-68",
        "400S137-97",
        "400S162-33",
        "400S162-43",
        "400S162-54",
        "400S162-68",
        "400S162-97",
        "400S200-33",
        "400S200-43",
        "400S200-54",
        "400S200-68",
        "400S200-97",
        "400S250-43",
        "400S250-54",
        "400S250-68",
        "400S250-97",
        "400S300-54",
        "400S300-68",
        "400S300-97"
    ],
    "5.5in": [
        "550S125-27",
        "550S125-30",
        "550S125-33",
        "550S125-43",
        "550S125-54",
        "550S125-68",
        "550S137-33",
        "550S137-43",
        "550S137-54",
        "550S137-68",
        "550S137-97",
        "550S162-33",
        "550S162-43",
        "550S162-54",
        "550S162-68",
        "550S162-97",
        "550S200-33",
        "550S200-43",
        "550S200-54",
        "550S200-68",
        "550S200-97",
        "550S250-43",
        "550S250-54",
        "550S250-68",
        "550S250-97"
    ],
    "6in": [
        "600S125-27",
        "600S125-30",
        "600S125-33",
        "600S125-43",
        "600S125-54",
        "600S125-68",
        "600S137-33",
        "600S137-43",
        "600S137-54",
        "600S137-68",
        "600S137-97",
        "600S137-118",
        "600S162-33",
        "600S162-43",
        "600S162-54",
        "600S162-68",
        "600S162-97",
        "600S162-118",
        "600S200-33",
        "600S200-43",
        "600S200-54",
        "600S200-68",
        "600S200-97",
        "600S200-118",
        "600S250-43",
        "600S250-54",
        "600S250-68",
        "600S250-97",
        "600S250-118",
        "600S300-54",
        "600S300-68",
        "600S300-97",
        "600S300-118",
        "600S350-54",
        "600S350-68",
        "600S350-97",
        "600S350-118"
    ],
    "8in": [
        "800S125-33",
        "800S125-43",
        "800S125-54",
        "800S125-68",
        "800S137-33",
        "800S137-43",
        "800S137-54",
        "800S137-68",
        "800S137-97",
        "800S137-118",
        "800S162-33",
        "800S162-43",
        "800S162-54",
        "800S162-68",
        "800S162-97",
        "800S162-118",
        "800S200-33",
        "800S200-43",
        "800S200-54",
        "800S200-68",
        "800S200-97",
        "800S200-118",
        "800S250-43",
        "800S250-54",
        "800S250-68",
        "800S250-97",
        "800S250-118",
        "800S300-54",
        "800S300-68",
        "800S300-97",
        "800S300-118",
        "800S350-54",
        "800S350-68",
        "800S350-97",
        "800S350-118"
    ],
    "10in": [
        "1000S162-43",
        "1000S162-54",
        "1000S162-68",
        "1000S162-97",
        "1000S162-118",
        "1000S200-43",
        "1000S200-54",
        "1000S200-68",
        "1000S200-97",
        "1000S200-118",
        "1000S250-43",
        "1000S250-54",
        "1000S250-68",
        "1000S250-97",
        "1000S250-118",
        "1000S300-54",
        "1000S300-68",
        "1000S300-97",
        "1000S300-118",
        "1000S350-54",
        "1000S350-68",
        "1000S350-97",
        "1000S350-118"
    ],
    "12in": [
        "1200S162-54",
        "1200S162-68",
        "1200S162-97",
        "1200S162-118",
        "1200S200-54",
        "1200S200-68",
        "1200S200-97",
        "1200S200-118",
        "1200S250-54",
        "1200S250-68",
        "1200S250-97",
        "1200S250-118",
        "1200S300-54",
        "1200S300-68",
        "1200S300-97",
        "1200S300-118",
        "1200S350-54",
        "1200S350-68",
        "1200S350-97",
        "1200S350-118"
    ],
    "14in": [
        "1400S162-54",
        "1400S162-68",
        "1400S162-97",
        "1400S162-118",
        "1400S200-54",
        "1400S200-68",
        "1400S200-97",
        "1400S200-118",
        "1400S250-54",
        "1400S250-68",
        "1400S250-97",
        "1400S250-118",
        "1400S300-54",
        "1400S300-68",
        "1400S300-97",
        "1400S300-118",
        "1400S350-54",
        "1400S350-68",
        "1400S350-97",
        "1400S350-118"
    ],
    "16in": [
        "1600S162-68",
        "1600S162-97",
        "1600S162-118",
        "1600S200-68",
        "1600S200-97",
        "1600S200-118",
        "1600S250-68",
        "1600S250-97",
        "1600S250-118",
        "1600S300-68",
        "1600S300-97",
        "1600S300-118",
        "1600S350-68",
        "1600S350-97",
        "1600S350-118"
    ]
};

  var trackSectionsByDepth = {
    "1.62in": [
        "162T125-18",
        "162T125-27",
        "162T125-30",
        "162T125-33"
    ],
    "2.5in": [
        "250T125-18",
        "250T125-27",
        "250T125-30",
        "250T125-33",
        "250T125-43",
        "250T125-54",
        "250T125-68",
        "250T125-97",
        "250T150-27",
        "250T150-30",
        "250T150-33",
        "250T150-43",
        "250T150-54",
        "250T150-68",
        "250T150-97",
        "250T200-33",
        "250T200-43",
        "250T200-54",
        "250T200-68",
        "250T200-97"
    ],
    "3.5in": [
        "350T125-18",
        "350T125-27",
        "350T125-30",
        "350T125-33",
        "350T125-43",
        "350T125-54",
        "350T125-68",
        "350T125-97",
        "350T150-27",
        "350T150-30",
        "350T150-33",
        "350T150-43",
        "350T150-54",
        "350T150-68",
        "350T150-97",
        "350T200-33",
        "350T200-43",
        "350T200-54",
        "350T200-68",
        "350T200-97",
        "350T250-54",
        "350T250-68",
        "350T250-97"
    ],
    "3.62in": [
        "362T125-18",
        "362T125-27",
        "362T125-30",
        "362T125-33",
        "362T125-43",
        "362T125-54",
        "362T125-68",
        "362T125-97",
        "362T150-27",
        "362T150-30",
        "362T150-33",
        "362T150-43",
        "362T150-54",
        "362T150-68",
        "362T150-97",
        "362T200-33",
        "362T200-43",
        "362T200-54",
        "362T200-68",
        "362T200-97",
        "362T250-54",
        "362T250-68",
        "362T250-97"
    ],
    "4in": [
        "400T125-18",
        "400T125-27",
        "400T125-30",
        "400T125-33",
        "400T125-43",
        "400T125-54",
        "400T125-68",
        "400T125-97",
        "400T150-27",
        "400T150-30",
        "400T150-33",
        "400T150-43",
        "400T150-54",
        "400T150-68",
        "400T150-97",
        "400T200-33",
        "400T200-43",
        "400T200-54",
        "400T200-68",
        "400T200-97",
        "400T250-43",
        "400T250-54",
        "400T250-68",
        "400T250-97"
    ],
    "5.5in": [
        "550T125-18",
        "550T125-27",
        "550T125-30",
        "550T125-33",
        "550T125-43",
        "550T125-54",
        "550T125-68",
        "550T125-97",
        "550T150-27",
        "550T150-30",
        "550T150-33",
        "550T150-43",
        "550T150-54",
        "550T150-68",
        "550T150-97",
        "550T200-33",
        "550T200-43",
        "550T200-54",
        "550T200-68",
        "550T200-97",
        "550T250-43",
        "550T250-54",
        "550T250-68",
        "550T250-97"
    ],
    "6in": [
        "600T125-18",
        "600T125-27",
        "600T125-30",
        "600T125-33",
        "600T125-43",
        "600T125-54",
        "600T125-68",
        "600T125-97",
        "600T125-118",
        "600T150-27",
        "600T150-30",
        "600T150-33",
        "600T150-43",
        "600T150-54",
        "600T150-68",
        "600T150-97",
        "600T150-118",
        "600T200-33",
        "600T200-43",
        "600T200-54",
        "600T200-68",
        "600T200-97",
        "600T250-43",
        "600T250-54",
        "600T250-68",
        "600T250-97",
        "600T250-118"
    ],
    "8in": [
        "800T125-33",
        "800T125-43",
        "800T125-54",
        "800T125-68",
        "800T125-97",
        "800T125-118",
        "800T150-33",
        "800T150-43",
        "800T150-54",
        "800T150-68",
        "800T150-97",
        "800T150-118",
        "800T200-33",
        "800T200-43",
        "800T200-54",
        "800T200-68",
        "800T200-97",
        "800T200-118",
        "800T250-43",
        "800T250-54",
        "800T250-68",
        "800T250-97",
        "800T250-118"
    ],
    "10in": [
        "1000T125-43",
        "1000T125-54",
        "1000T125-68",
        "1000T125-97",
        "1000T125-118",
        "1000T150-43",
        "1000T150-54",
        "1000T150-68",
        "1000T150-97",
        "1000T150-118",
        "1000T200-43",
        "1000T200-54",
        "1000T200-68",
        "1000T200-97",
        "1000T200-118",
        "1000T250-43",
        "1000T250-54",
        "1000T250-68",
        "1000T250-97",
        "1000T250-118"
    ],
    "12in": [
        "1200T125-54",
        "1200T125-68",
        "1200T125-97",
        "1200T125-118",
        "1200T150-54",
        "1200T150-68",
        "1200T150-97",
        "1200T150-118",
        "1200T200-54",
        "1200T200-68",
        "1200T200-97",
        "1200T200-118",
        "1200T250-54",
        "1200T250-68",
        "1200T250-97",
        "1200T250-118"
    ],
    "14in": [
        "1400T125-54",
        "1400T125-68",
        "1400T125-97",
        "1400T125-118",
        "1400T150-54",
        "1400T150-68",
        "1400T150-97",
        "1400T150-118",
        "1400T200-54",
        "1400T200-68",
        "1400T200-97",
        "1400T200-118",
        "1400T250-54",
        "1400T250-68",
        "1400T250-97",
        "1400T250-118"
    ],
    "16in": [
        "1600T125-68",
        "1600T125-97",
        "1600T125-118",
        "1600T150-68",
        "1600T150-97",
        "1600T200-68",
        "1600T200-97",
        "1600T200-118",
        "1600T250-68",
        "1600T250-97",
        "1600T250-118"
    ]
};

  // ================================================================
  // PUBLIC FUNCTIONS
  // ================================================================

  /**
   * Get stud section properties object.
   * @param {string} section  Section name, e.g. "600S200-43"
   * @param {number} [Fy=33]  Yield strength in ksi (33 or 50)
   * @returns {Object|null}
   */
  function getStudProps(section, Fy) {
    Fy = Fy || 33;
    return studData[section + "_" + Fy + "ksi"] || null;
  }

  /**
   * Get track section properties object.
   * @param {string} section  Section name, e.g. "600T150-43"
   * @returns {Object|null}
   */
  function getTrackProps(section) {
    return trackData[section] || null;
  }

  /**
   * Returns stud properties with human-readable keys for use in display tables.
   * @param {string} section  e.g. "600S200-43"
   * @param {number} [Fy=33]  33 or 50 ksi
   * @returns {Object|null}
   */
  function getStudPropsForTable(section, Fy) {
    var p = getStudProps(section, Fy || 33);
    if (!p) return null;
    return {
      "Section":         section,
      "Fy (ksi)":        p.Fy_ksi,
      "t (in)":          p.thickness_in,
      "A (in2)":         p.area_in2,
      "W (lb/ft)":       p.weight_lbft,
      "Ix (in4)":        p.Ix_in4,
      "Sx (in3)":        p.Sx_in3,
      "rx (in)":         p.Rx_in,
      "Iy (in4)":        p.Iy_in4,
      "ry (in)":         p.Ry_in,
      "Ixe (in4)":       p.Ixe_in4,
      "Sxe (in3)":       p.Sxe_in3,
      "Mal (in-k)":      p.Mal_inkip,
      "Mad (in-k)":      p.Mad_inkip,
      "Vag (lb)":        p.Vag_lb,
      "Vnet (lb)":       p.Vnet_lb,
      "Jx x10-3 (in4)":  p.Jx1000_in4,
      "Cw (in6)":        p.Cw_in6,
      "Xo (in)":         p.Xo_in,
      "m (in)":          p.m_in,
      "Ro (in)":         p.Ro_in,
      "beta (in)":       p.beta_in,
      "Lu (ft)":         p.Lu_ft
    };
  }

  /**
   * Returns track properties with human-readable keys for use in display tables.
   * @param {string} section  e.g. "600T150-43"
   * @returns {Object|null}
   */
  function getTrackPropsForTable(section) {
    var p = getTrackProps(section);
    if (!p) return null;
    return {
      "Section":              section,
      "t (in)":               p.thickness_in,
      "A (in2)":              p.area_in2,
      "W (lb/ft)":            p.weight_lbft,
      "Ix (in4)":             p.Ix_in4,
      "Sx (in3)":             p.Sx_in3,
      "rx (in)":              p.Rx_in,
      "Iy (in4)":             p.Iy_in4,
      "ry (in)":              p.Ry_in,
      "Ixe @ 33k (in4)":      p.Ixe_33_in4,
      "Sxe @ 33k (in3)":      p.Sxe_33_in3,
      "Ma @ 33k (in-k)":      p.Ma_33_inkip,
      "Vag @ 33k (lb)":       p.Vag_33_lb,
      "Ixe @ 50k (in4)":      p.Ixe_50_in4,
      "Sxe @ 50k (in3)":      p.Sxe_50_in3,
      "Ma @ 50k (in-k)":      p.Ma_50_inkip,
      "Vag @ 50k (lb)":       p.Vag_50_lb,
      "Jx x10-3 (in4)":       p.Jx1000_in4,
      "Cw (in6)":             p.Cw_in6,
      "Xo (in)":              p.Xo_in,
      "m (in)":               p.m_in,
      "Ro (in)":              p.Ro_in,
      "beta (in)":            p.beta_in
    };
  }

  /**
   * Populate an HTML <select> element with grouped stud options.
   * Sections are grouped by web depth using <optgroup>.
   *
   * @param {HTMLSelectElement|string} selectEl  Element or element ID
   * @param {Object}  [opts]
   * @param {boolean} [opts.only50ksi=false]  Only show sections available at 50 ksi
   * @param {string}  [opts.placeholder]      First empty option label (default: "-- Select Stud --")
   *
   * HTML usage:
   *   <select id="studSelect" onchange="var p=SSMA.getStudProps(this.value,33); ..."></select>
   *   <script> SSMA.populateStudSelect("studSelect"); </script>
   */
  function populateStudSelect(selectEl, opts) {
    if (typeof selectEl === "string") selectEl = document.getElementById(selectEl);
    if (!selectEl) return;
    opts = opts || {};
    var ph = (opts.placeholder !== undefined) ? opts.placeholder : "-- Select Stud --";
    selectEl.innerHTML = "";
    if (ph) {
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = ph;
      selectEl.appendChild(blank);
    }
    Object.keys(studSectionsByDepth).forEach(function(depth) {
      var grp = document.createElement("optgroup");
      grp.label = depth + " Web Stud";
      studSectionsByDepth[depth].forEach(function(sec) {
        if (opts.only50ksi && !studData[sec + "_50ksi"]) return;
        var opt = document.createElement("option");
        opt.value = sec; opt.textContent = sec;
        grp.appendChild(opt);
      });
      if (grp.children.length) selectEl.appendChild(grp);
    });
  }

  /**
   * Populate an HTML <select> element with grouped track options.
   *
   * @param {HTMLSelectElement|string} selectEl  Element or element ID
   * @param {Object}  [opts]
   * @param {boolean} [opts.only50ksi=false]  Only show sections with 50 ksi data
   * @param {string}  [opts.placeholder]      First empty option label (default: "-- Select Track --")
   */
  function populateTrackSelect(selectEl, opts) {
    if (typeof selectEl === "string") selectEl = document.getElementById(selectEl);
    if (!selectEl) return;
    opts = opts || {};
    var ph = (opts.placeholder !== undefined) ? opts.placeholder : "-- Select Track --";
    selectEl.innerHTML = "";
    if (ph) {
      var blank = document.createElement("option");
      blank.value = ""; blank.textContent = ph;
      selectEl.appendChild(blank);
    }
    Object.keys(trackSectionsByDepth).forEach(function(depth) {
      var grp = document.createElement("optgroup");
      grp.label = depth + " Web Track";
      trackSectionsByDepth[depth].forEach(function(sec) {
        var d = trackData[sec];
        if (opts.only50ksi && (!d || d.Ma_50_inkip === null)) return;
        var opt = document.createElement("option");
        opt.value = sec; opt.textContent = sec;
        grp.appendChild(opt);
      });
      if (grp.children.length) selectEl.appendChild(grp);
    });
  }

  // ================================================================
  // EXPORTS
  // ================================================================
  return {
    studData:              studData,
    trackData:             trackData,
    studSections:          studSections,
    studSections50ksi:     studSections50ksi,
    trackSections:         trackSections,
    trackSections50ksi:    trackSections50ksi,
    studSectionsByDepth:   studSectionsByDepth,
    trackSectionsByDepth:  trackSectionsByDepth,
    getStudProps:          getStudProps,
    getTrackProps:         getTrackProps,
    getStudPropsForTable:  getStudPropsForTable,
    getTrackPropsForTable: getTrackPropsForTable,
    populateStudSelect:    populateStudSelect,
    populateTrackSelect:   populateTrackSelect
  };

}());

// Node.js / CommonJS compatibility
if (typeof module !== "undefined" && module.exports) { module.exports = SSMA; }
