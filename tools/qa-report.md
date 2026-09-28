# ARE calc save/load QA report

Run: 2026-09-28T02:51:17.383Z

**58/59 passed.**

| Calc | Fields | KB | Model | Offline reqs | Result |
|---|---|---|---|---|---|
| 4_story_shear_wall_calculator.html | 18 | 51 | - | 0 | pass |
| AISI_S100_16_Screw_Calculator.html | 17 | 74 | - | 0 | pass |
| AISI_S100_16_Weld_Calculator.html | 72 | 99 | - | 0 | pass |
| CFS_Stud_Combined_Bending_Compression.html | 15 | 99 | - | 0 | pass |
| CFS_Wall_Opening_Header_Sill_Jamb_calculator.html | 30 | 133 | - | 0 | pass |
| F11_plate_bending_calculator.html | 11 | 70 | - | 0 | pass |
| HSS_column_brace_gusset_calculator.html | 36 | 82 | - | 0 | pass |
| HSS_to_HSS_branch_connection_calculator.html | 36 | 250 | - | 0 | pass |
| SW_HoldownFooting_Calculator.html | 17 | 81 | - | - | **FAIL** (diff) results text differs @193
    before: …bined continuous strip + spread pad footing — uplift & bearing checks IBC 2024 ASCE 7-22 ACI 318-19 ASD Load Combos Combined Footing — Secti…
    after : …bined continuous strip + s |
| W_beam_to_HSS_column_calculator.html | 30 | 108 | - | 0 | pass |
| apa_panel_uniform_load_calculator.html | 16 | 66 | - | 0 | pass |
| asce716_cc_wind_calculator.html | 19 | 115 | - | 0 | pass |
| asce716_mwfrs_calculator.html | 28 | 94 | yes | 0 | pass |
| asce_irregularity_calculator.html | 37 | 82 | - | 0 | pass |
| beam_calculator.html | 7 | 127 | - | 0 | pass |
| belled_pier_calculator.html | 16 | 84 | - | 0 | pass |
| brace_connection_at_column_on_beam_calculator.html | 67 | 101 | - | 0 | pass |
| cantilever_plate_deflection_calculator.html | 16 | 60 | - | 0 | pass |
| channel_brace_connection_calculator.html | 24 | 94 | - | 0 | pass |
| channel_joist_bearing_calculator.html | 21 | 84 | - | 0 | pass |
| column_base_plate_calculator.html | 26 | 84 | - | 0 | pass |
| column_base_plate_v3.html | 705 | 518 | - | 0 | pass |
| column_bearing_plate_slab_calculator.html | 10 | 81 | - | 0 | pass |
| composite_stud_blockout_calculator.html | 56 | 28 | - | 0 | pass |
| concrete_beam_design_calculator.html | 34 | 125 | - | 0 | pass |
| counterfort_bay_v4.html | 19 | 83 | - | 0 | pass |
| deep_beam_stm_calculator.html | 100 | 106 | - | 0 | pass |
| embed_plate_beam_bearing_calculator.html | 26 | 119 | - | 0 | pass |
| flange_plated_HSS_column_moment_connection_calculator.html | 41 | 66 | - | 0 | pass |
| headers_gradebeam_pier_calculator.html | 41 | 82 | yes | 0 | pass |
| hss_column_bearing_on_beam_calculator.html | 51 | 50 | - | 0 | pass |
| hss_hanger_tension_connection_calculator.html | 17 | 57 | - | 0 | pass |
| large_moment_base_plate.html | 13 | 86 | - | 0 | pass |
| masonry_anchor_bolt_calculator.html | 22 | 87 | - | 0 | pass |
| masonry_anchor_calculator.html | 28 | 116 | - | 0 | pass |
| masonry_asd_design_calculator.html | 13 | 60 | - | 0 | pass |
| masonry_bearing_uplift_calculator.html | 15 | 84 | - | 0 | pass |
| masonry_dowelled_embed_plate_calculator.html | 23 | 70 | - | 0 | pass |
| masonry_lap_length_calculator.html | 10 | 73 | - | 0 | pass |
| masonry_lintel_asd_calculator.html | 22 | 88 | - | 0 | pass |
| masonry_lintel_jamb_calculator.html | 41 | 170 | - | 0 | pass |
| masonry_opening_channel_lintel_calculator.html | 36 | 84 | - | 0 | pass |
| masonry_reinforced_wall_asd_calculator.html | 40 | 128 | - | 0 | pass |
| rectangular_diaphragm_calculator.html | 21 | 79 | - | 0 | pass |
| seated_beam_connection_calculator.html | 48 | 48 | - | 0 | pass |
| snow_load_calculator.html | 61 | 96 | - | 0 | pass |
| stacked_headers_studs_calculator.html | 19 | 208 | yes | 0 | pass |
| stacked_shearwall_calculator.html | 3 | 289 | yes | 0 | pass |
| steel_joist_selector_calculator.html | 5 | 67 | yes | 0 | pass |
| straight_shaft_pier_calculator.html | 17 | 84 | - | 0 | pass |
| through_plate_calculator.html | 38 | 215 | - | 0 | pass |
| tji-purlin-calculator.html | 19 | 62 | - | 0 | pass |
| unistrut_p1000hs_calculator.html | 4 | 67 | - | 0 | pass |
| unreinforced_cmu_wall_asd_calculator.html | 9 | 76 | - | 0 | pass |
| web_opening_calculator.html | 21 | 153 | yes | 0 | pass |
| web_stiffener_calculator.html | 9 | 99 | - | 0 | pass |
| wood_connection_schedule_calculator.html | 14 | 223 | yes | 0 | pass |
| wood_diaphragm_designer.html | 27 | 78 | - | 0 | pass |
| wri_stiffened_slab_calculator.html | 21 | 77 | - | 0 | pass |

## Failures by stage

### diff (1)

- **SW_HoldownFooting_Calculator.html** — results text differs @193
    before: …bined continuous strip + spread pad footing — uplift & bearing checks IBC 2024 ASCE 7-22 ACI 318-19 ASD Load Combos Combined Footing — Secti…
    after : …bined continuous strip + spread pad footing — uplift & bearing checks | Project: QA-TEST IBC 2024 ASCE 7-22 ACI 318-19 ASD Load Combos Combi…

