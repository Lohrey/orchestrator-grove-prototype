const MAX_POINTS: usize = 4096;

static mut POINT_IDS: [u32; MAX_POINTS] = [0; MAX_POINTS];
static mut POINT_KINDS: [u32; MAX_POINTS] = [0; MAX_POINTS];
static mut POINT_X: [f32; MAX_POINTS] = [0.0; MAX_POINTS];
static mut POINT_Y: [f32; MAX_POINTS] = [0.0; MAX_POINTS];
static mut LAST_STEP_X: f32 = 0.0;
static mut LAST_STEP_Y: f32 = 0.0;

#[no_mangle]
pub extern "C" fn sim_core_version() -> u32 {
    1
}

#[no_mangle]
pub extern "C" fn clear_points() {
    unsafe {
        for i in 0..MAX_POINTS {
            POINT_IDS[i] = 0;
            POINT_KINDS[i] = 0;
            POINT_X[i] = 0.0;
            POINT_Y[i] = 0.0;
        }
    }
}

#[no_mangle]
pub extern "C" fn set_point(index: u32, id: u32, kind: u32, x: f32, y: f32) {
    let i = index as usize;
    if i >= MAX_POINTS {
        return;
    }
    unsafe {
        POINT_IDS[i] = id;
        POINT_KINDS[i] = kind;
        POINT_X[i] = x;
        POINT_Y[i] = y;
    }
}

#[no_mangle]
pub extern "C" fn nearest_point(qx: f32, qy: f32, kind: u32, len: u32) -> i32 {
    let count = (len as usize).min(MAX_POINTS);
    let mut best_id: i32 = -1;
    let mut best_distance = f32::INFINITY;
    unsafe {
        for i in 0..count {
            let id = POINT_IDS[i];
            if id == 0 {
                continue;
            }
            if kind != 0 && POINT_KINDS[i] != kind {
                continue;
            }
            let dx = POINT_X[i] - qx;
            let dy = POINT_Y[i] - qy;
            let distance = dx * dx + dy * dy;
            if distance < best_distance {
                best_distance = distance;
                best_id = id as i32;
            }
        }
    }
    best_id
}

#[no_mangle]
pub extern "C" fn chunk_coord(value: f32, chunk_size: f32) -> i32 {
    if chunk_size <= 0.0 {
        return 0;
    }
    (value / chunk_size).floor() as i32
}

#[no_mangle]
pub extern "C" fn compute_next_step(
    x: f32,
    y: f32,
    tx: f32,
    ty: f32,
    dt: f32,
    speed: f32,
    close: f32,
) -> i32 {
    let dx = tx - x;
    let dy = ty - y;
    let distance = (dx * dx + dy * dy).sqrt();
    if distance <= close || distance <= 0.0001 {
        unsafe {
            LAST_STEP_X = tx;
            LAST_STEP_Y = ty;
        }
        return 1;
    }
    let step = speed * dt;
    let ratio = if step >= distance {
        1.0
    } else {
        step / distance
    };
    unsafe {
        LAST_STEP_X = x + dx * ratio;
        LAST_STEP_Y = y + dy * ratio;
    }
    if step >= distance {
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn last_step_x() -> f32 {
    unsafe { LAST_STEP_X }
}

#[no_mangle]
pub extern "C" fn last_step_y() -> f32 {
    unsafe { LAST_STEP_Y }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nearest_filters_by_kind() {
        clear_points();
        set_point(0, 10, 1, 0.0, 0.0);
        set_point(1, 20, 2, 2.0, 0.0);
        set_point(2, 30, 1, 8.0, 0.0);
        assert_eq!(nearest_point(1.0, 0.0, 0, 3), 10);
        assert_eq!(nearest_point(1.0, 0.0, 2, 3), 20);
        assert_eq!(nearest_point(1.0, 0.0, 99, 3), -1);
    }

    #[test]
    fn stepping_and_chunks_work() {
        assert_eq!(chunk_coord(511.0, 256.0), 1);
        assert_eq!(compute_next_step(0.0, 0.0, 10.0, 0.0, 0.5, 10.0, 1.0), 0);
        assert_eq!(last_step_x(), 5.0);
        assert_eq!(last_step_y(), 0.0);
    }
}
