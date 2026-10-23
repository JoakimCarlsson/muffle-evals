use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct Settings {
    last_updated: toml::value::Datetime,
    minimum_interval: i64,
}

#[test]
fn value_into_struct_with_datetime() {
    let v: toml::value::Table = toml::from_str(
        "[settings]\nlast_updated = 2023-01-15T11:42:14-06:00\nminimum_interval = 3600\n",
    )
    .unwrap();
    let x = v.get("settings").unwrap().clone();
    let n = Settings::deserialize(x).unwrap();
    assert_eq!(n.last_updated.to_string(), "2023-01-15T11:42:14-06:00");
    assert_eq!(n.minimum_interval, 3600);
}

#[test]
fn value_try_into_datetime() {
    let v: toml::Value = toml::from_str("a = 1979-05-27").unwrap();
    let d: toml::value::Datetime = v["a"].clone().try_into().unwrap();
    assert_eq!(d.to_string(), "1979-05-27");
}
