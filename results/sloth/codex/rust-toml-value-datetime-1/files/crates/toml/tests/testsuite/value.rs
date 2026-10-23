use snapbox::assert_data_eq;
use snapbox::prelude::*;
use snapbox::str;

use toml::Value::{Array, Boolean, Float, Integer, String, Table};
use toml::map::Map;

/// Datetimes retain their type for typed requests and remain strings for JSON.
#[test]
fn deserialize_datetime() {
    use serde::Deserialize;
    use toml::value::Datetime;

    #[derive(Debug, Deserialize, PartialEq)]
    struct Settings {
        last_updated: Datetime,
        minimum_interval: i64,
    }

    for datetime in [
        "2023-01-15T11:42:14-06:00",
        "2023-01-15T11:42:14Z",
        "2023-01-15T11:42:14.123456789",
        "2023-01-15",
        "11:42:14",
    ] {
        let document = format!("[settings]\nlast_updated = {datetime}\nminimum_interval = 3600\n");
        let table: toml::Table = toml::from_str(&document).unwrap();
        let value = table.get("settings").unwrap().clone();
        let expected: Settings =
            toml::from_str(document.strip_prefix("[settings]\n").unwrap()).unwrap();
        assert_eq!(Settings::deserialize(value.clone()).unwrap(), expected);
        assert_eq!(value.clone().try_into::<Settings>().unwrap(), expected);

        let date = value.get("last_updated").unwrap().clone();
        assert_eq!(
            date.clone().try_into::<Datetime>().unwrap(),
            expected.last_updated
        );
        assert_eq!(
            serde_json::Value::deserialize(date.clone()).unwrap(),
            datetime
        );
        assert_eq!(date.try_into::<std::string::String>().unwrap(), datetime);
        assert_eq!(
            serde_json::Value::deserialize(value).unwrap(),
            serde_json::json!({"last_updated": datetime, "minimum_interval": 3600})
        );
    }

    let error = String("2023-01-15T11:42:14-06:00".to_owned())
        .try_into::<Datetime>()
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        "invalid type: string \"2023-01-15T11:42:14-06:00\", expected a TOML datetime\n"
    );
}

#[test]
fn display() {
    assert_data_eq!(
        String("foo".to_owned()).to_string(),
        str![[r#""foo""#]].raw()
    );
    assert_data_eq!(Integer(10).to_string(), str!["10"].raw());
    assert_data_eq!(Float(10.0).to_string(), str!["10.0"].raw());
    assert_data_eq!(Float(2.4).to_string(), str!["2.4"].raw());
    assert_data_eq!(Boolean(true).to_string(), str!["true"].raw());
    assert_data_eq!(Array(vec![]).to_string(), str!["[]"].raw());
    assert_data_eq!(
        Array(vec![Integer(1), Integer(2)]).to_string(),
        str!["[1, 2]"].raw()
    );
    assert_data_eq!(
        Table(map! {"test" => Integer (2), "test2" => Integer(3)}).to_string(),
        str!["{ test = 2, test2 = 3 }"].raw()
    );
}
